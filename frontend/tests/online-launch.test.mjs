import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
const source = await readFile(new URL('../public/webpushr-sw.js', import.meta.url), 'utf8');
const html = version => `<div id="root"></div><script src="/_expo/static/js/web/entry-${version}.js" defer></script>`;
const response = (text, type='text/html', status=200) => new Response(text,{status,headers:{'content-type':type}});
function harness(fetcher) {
  const entries = new Map([['/index.html', response(html('A'))]]);
  const key = input => new URL(typeof input === 'string' ? input : input.url, 'https://staging.theipm.ca').pathname;
  const cache = {match:async input=>entries.get(key(input))?.clone(),put:async(input,res)=>{entries.set(key(input),new Response(await res.arrayBuffer(),{status:res.status,headers:res.headers}));}};
  const handlers={};
  const context=vm.createContext({URL,AbortController,Response,console:{error(){}},setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,35)),clearTimeout,
    self:{location:{href:'https://staging.theipm.ca/webpushr-sw.js',origin:'https://staging.theipm.ca'},addEventListener:(name,fn)=>handlers[name]=fn},
    caches:{open:async()=>cache,match:cache.match},fetch:fetcher});
  vm.runInContext(source,context);
  return {entries,cache,handlers,launch:()=>vm.runInContext("currentLaunch({url:'https://staging.theipm.ca/itinerary'})",context)};
}
test('first navigation gets B then C; each startup asset is cached before HTML changes',async()=>{
  let version='B';let h;
  h=harness(async(input,options)=>{
    assert.equal(options.cache,'no-store');
    if(typeof input!=='string')return response(html(version));
    assert.notEqual(await h.entries.get('/index.html').clone().text(),html(version));
    return response(`/* ${version} */`,'application/javascript');
  });
  for(const next of ['B','C']){
    version=next;assert.equal(await (await h.launch()).text(),html(next));
    assert.equal(await h.entries.get('/index.html').clone().text(),html(next));
    assert(h.entries.has(`/_expo/static/js/web/entry-${next}.js`));
  }
});
test('offline, server errors, non-app HTML and missing JS retain known-good HTML',async()=>{
  for(const fail of ['offline','server','html','asset']){
    const h=harness(async input=>{
      if(fail==='offline')throw Error('offline');
      if(fail==='server')return response('error','text/html',503);
      if(fail==='html')return response('<h1>Maintenance</h1>');
      return typeof input==='string'?response('missing','text/html',404):response(html('B'));
    });
    assert.equal(await (await h.launch()).text(),html('A'));
    assert.equal(await h.entries.get('/index.html').clone().text(),html('A'));
  }
});
test('hung network is bounded; late completion cannot replace fallback HTML',async()=>{
  let finish;const h=harness(()=>new Promise(resolve=>{finish=resolve;}));
  const start=Date.now();assert.equal(await (await h.launch()).text(),html('A'));assert(Date.now()-start<500);
  finish(response('<h1>late</h1>'));await new Promise(r=>setTimeout(r,15));
  assert.equal(await h.entries.get('/index.html').clone().text(),html('A'));
});
test('failed startup asset never commits B, including a body read failure',async()=>{
  const h=harness(async input=>typeof input!=='string'?response(html('B')):new Response(new ReadableStream({start(c){c.error(Error('broken transfer'));}}),{headers:{'content-type':'application/javascript'}}));
  assert.equal(await (await h.launch()).text(),html('A'));
});
test('cached startup assets from newer HTML are served by the incumbent worker',async()=>{
  const h=harness(async input=>typeof input!=='string'?response(html('B')):response('B','application/javascript'));
  await h.launch();let result;
  h.handlers.fetch({request:{url:'https://staging.theipm.ca/_expo/static/js/web/entry-B.js',method:'GET',mode:'cors'},respondWith:p=>{result=p;}});
  assert.equal(await (await result).text(),'B');
});
test('explicit activate message may skipWaiting; no reload loops or foreign fetch interception',()=>{
  assert.doesNotMatch(source,/location\.reload|client\.navigate/);
  assert.match(source,/event\.data\?\.type === 'IPM_ACTIVATE_UPDATE'/);
  assert.equal((source.match(/self\.skipWaiting\(\)/g)||[]).length,1);
  assert.doesNotMatch(source,/addEventListener\(['"]install['"][\s\S]*skipWaiting/);
  const h=harness(()=>{throw Error('unexpected network');});
  for(const request of [{url:'https://staging.theipm.ca/api/schedule',method:'GET'},{url:'https://staging.theipm.ca/x',method:'POST'},{url:'https://external.example/x',method:'GET'}])h.handlers.fetch({request,respondWith:()=>assert.fail('intercepted')});
});
