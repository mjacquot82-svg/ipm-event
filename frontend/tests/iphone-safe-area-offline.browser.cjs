// Real generated offline shell; only the remote push provider is replaced with a local stub.
const {chromium}=require(process.env.IPM_PLAYWRIGHT_MODULE||'/tmp/ipm-browser-tools/node_modules/playwright');
const http=require('node:http');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist');
const server=http.createServer((req,res)=>{
 let name=new URL(req.url,'http://localhost').pathname;
 if(name==='/test-provider.js'){res.setHeader('Content-Type','text/javascript');return res.end('self.WonderPush=[];');}
 if(name==='/api/vendors')name='/api/vendors.json';
 let file=path.join(root,name);if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(root,'index.html');
 res.setHeader('Content-Type',({'.js':'text/javascript','.json':'application/json','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf'}[path.extname(file)]||'application/octet-stream'));
 let data=fs.readFileSync(file);if(name==='/webpushr-sw.js')data=data.toString().replace('https://cdn.by.wonderpush.com/sdk/1.1/wonderpush-loader.min.js','/test-provider.js');res.end(data);
});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const b=await chromium.launch({args:['--no-sandbox']});try{
 const c=await b.newContext({viewport:{width:393,height:852}});const p=await c.newPage();await p.route('**/*',r=>r.request().method()!=='GET'||/wonderpush|google-analytics/.test(r.request().url())?r.abort():r.continue());
 await p.goto(`http://127.0.0.1:${server.address().port}/map`);await p.getByTestId('map-mode-selector').waitFor();
 await p.evaluate(async()=>{await navigator.serviceWorker.register('/webpushr-sw.js');await navigator.serviceWorker.ready;});
 await p.waitForFunction(async()=>!!(await caches.match('/index.html')));
 await c.setOffline(true);await p.reload();await p.getByTestId('map-mode-selector').waitFor();
 await p.getByTestId('map-mode-rv').click();await p.getByTestId('rv-site-search').fill('M27');await p.getByText('RV Site M27',{exact:true}).click();await p.getByTestId('rv-site-highlight').waitFor({state:'attached'});
 await p.getByTestId('map-artwork-rv-error').waitFor();
 assert.equal(await p.getByTestId('map-artwork-rv-loading').count(),0);
 assert.equal(await p.getByTestId('rv-site-title').isVisible(),true);
 console.log('PASS: generated production shell installs, reloads Maps offline, switches Camping, and resolves manual M27. Push provider stubbed; no remote writes.');
}finally{await b.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
