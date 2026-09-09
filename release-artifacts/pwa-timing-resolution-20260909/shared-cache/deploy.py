import json,pathlib,urllib.request,urllib.parse,hashlib,re,sys,concurrent.futures,subprocess,time
A=pathlib.Path(__file__).resolve().parent;old=A.parent/'launch-update-final-20260909';work=pathlib.Path('/workspaces/ipm-event/.worktrees/launch-update-staging');site='0932cc5d-9cb8-4cd3-8418-7e486df75bf1'
c=json.loads((pathlib.Path.home()/'.config/netlify/config.json').read_text());a=c['users'][c['userId']]['auth'];token=a['token'] if isinstance(a,dict) else a
def api(path,method='GET',body=None,raw=False):
 r=urllib.request.Request('https://api.netlify.com/api/v1'+path,data=body if raw else json.dumps(body).encode() if body is not None else None,headers={'Authorization':'Bearer '+token,'Content-Type':'application/octet-stream' if raw else 'application/json'},method=method)
 return json.load(urllib.request.urlopen(r,timeout=45))
def get(url):
 cache=A/'downloads'/hashlib.sha256(url.encode()).hexdigest();cache.parent.mkdir(exist_ok=True)
 if cache.exists():return cache.read_bytes()
 for attempt in range(3):
  try:
   b=urllib.request.urlopen(url,timeout=25).read();cache.write_bytes(b);return b
  except Exception:
   if attempt==2:raise

mode=sys.argv[1]
if mode=='build':
 template=(work/'frontend/public/webpushr-sw.js').read_text();source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=work,text=True).strip()
 for label in ['A','B','C']:
  before=json.loads((old/f'{label}-draft.json').read_text())['id'];base='https://'+before+'--ipm-web-staging.netlify.app';worker=get(base+'/webpushr-sw.js').decode();assets=json.loads(re.search(r'const IPM_SHELL_ASSETS = (\[.*?\]);',worker,re.S).group(1))
  paths=[p for p in assets if p!='/'];data=dict(zip(paths,concurrent.futures.ThreadPoolExecutor(8).map(lambda p:get(base+p),paths)))
  digest=hashlib.sha256(template.encode())
  for path in assets:
   digest.update(path.encode())
   if path!='/':digest.update(data[path])
  version=digest.hexdigest()[:16];body=template.replace("const IPM_OFFLINE_VERSION = 'development';",f"const IPM_OFFLINE_VERSION = '{version}';").replace("const IPM_SHELL_ASSETS = ['/', '/index.html', '/manifest.json'];",'const IPM_SHELL_ASSETS = '+json.dumps(assets,indent=2)+';').encode()
  files={i['path']:i['sha'] for i in api('/deploys/'+before+'/files')};files['/webpushr-sw.js']=hashlib.sha1(body).hexdigest()
  d=api('/sites/'+site+'/deploys','POST',{'files':files,'draft':True,'title':f'Bounded install {label} {source}','branch':'fix/launch-update-staging-20260909'})
  for sha in d.get('required',[]):
   assert sha==hashlib.sha1(body).hexdigest();api('/deploys/'+d['id']+'/files/webpushr-sw.js','PUT',body,True)
  for _ in range(30):
   d=api('/deploys/'+d['id'])
   if d['state']=='ready':break
   time.sleep(1)
  assert d['state']=='ready';(A/f'{label}-draft.json').write_text(json.dumps({k:d.get(k) for k in ['id','state','title','deploy_ssl_url']},indent=2));(A/f'{label}-worker.js').write_bytes(body)
  identity=json.loads((old/f'{label}-identity.json').read_text());identity['worker']=version;(A/f'{label}-identity.json').write_text(json.dumps(identity,indent=2));print(label,d['id'],identity,flush=True)
else:
 label=mode;expected=sys.argv[2];assert api('/sites/'+site)['published_deploy']['id']==expected
 d=json.loads((A/f'{label}-draft.json').read_text());r=api('/sites/'+site+'/deploys/'+d['id']+'/restore','POST');(A/f'{label}-published.json').write_text(json.dumps({k:r.get(k) for k in ['id','state','title','published_at']},indent=2));print(label,r['id'])
