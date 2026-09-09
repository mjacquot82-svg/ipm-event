import hashlib,json,sys,urllib.request,urllib.parse,subprocess
from pathlib import Path
A=Path(__file__).resolve().parent
mode,target=sys.argv[1:3]
SITE='0932cc5d-9cb8-4cd3-8418-7e486df75bf1' if target=='staging' else 'c64b53c9-5b39-441c-910a-dc00db77b4a5'
BEFORE='6aa091b2b8f161cc3b981158' if target=='staging' else '6aa0ccd4556bd25f58ba346d'
branch='fix/public-ux-staging-20260909' if target=='staging' else 'fix/public-ux-pwa-audit-20260909'
work=Path('/workspaces/ipm-event/.worktrees/public-ux-staging' if target=='staging' else '/workspaces/ipm-event/.worktrees/public-ux-pwa-audit')
c=json.loads((Path.home()/'.config/netlify/config.json').read_text());a=c['users'][c['userId']]['auth'];token=a['token'] if isinstance(a,dict) else a
base='https://api.netlify.com/api/v1'
def req(path,method='GET',body=None,content='application/json'):
 data=json.dumps(body).encode() if body is not None and content=='application/json' else body
 r=urllib.request.Request(base+path,data=data,method=method,headers={'Authorization':'Bearer '+token,'Content-Type':content})
 with urllib.request.urlopen(r,timeout=60) as x:return json.load(x)
def save(name,d):
 clean={k:d.get(k) for k in ['id','state','title','published_at','deploy_ssl_url','commit_ref','error_message']};(A/(target+'-'+name+'.json')).write_text(json.dumps(clean,indent=2));return clean
if mode=='draft':
 assert req('/sites/'+SITE)['published_deploy']['id']==BEFORE,'Published deployment changed; stop'
 old=req('/deploys/'+BEFORE+'/files');files={i['path'].lower():i['sha'] for i in old};blobs={}
 if target=='staging':
  dist=work/'frontend/dist';paths=[dist/'index.html',dist/'webpushr-sw.js',*dist.glob('_expo/static/js/web/*.js'),*dist.glob('assets/**/*')]
 else:
  dist=A/'production-candidate';paths=list(dist.rglob('*'))
 for p in paths:
  if not p.is_file():continue
  path='/'+str(p.relative_to(dist));data=p.read_bytes();sha=hashlib.sha1(data).hexdigest()
  if path.lower() in files and path not in ['/index.html','/webpushr-sw.js']:
   assert files[path.lower()]==sha,'Existing asset differs: '+path
  files[path.lower()]=sha;blobs[sha]=(path,data)
 source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=work,text=True).strip()
 (A/(target+'-manifest.json')).write_text(json.dumps({'source_sha':source,'base_deploy':BEFORE,'files':files},indent=2))
 d=req('/sites/'+SITE+'/deploys','POST',dict(files=files,draft=True,title='Attendee UX cleanup; no worker logic change '+source,branch=branch));print(save('draft',d),flush=True)
 for sha in d.get('required',[]):
  assert sha in blobs,'Required retained asset unavailable locally'
  path,data=blobs[sha];req('/deploys/'+d['id']+'/files'+urllib.parse.quote(path),'PUT',data,'application/octet-stream')
 print('Upload complete',flush=True)
elif mode=='status':
 d=json.loads((A/(target+'-draft.json')).read_text());print(save('ready',req('/deploys/'+d['id'])))
elif mode=='publish':
 d=json.loads((A/(target+'-draft.json')).read_text());assert req('/sites/'+SITE)['published_deploy']['id']==BEFORE,'Published deployment changed; stop';assert req('/deploys/'+d['id'])['state']=='ready'
 assert json.loads((A/(target+'-gates.json')).read_text())['passed']
 print(save('published',req('/sites/'+SITE+'/deploys/'+d['id']+'/restore','POST')))
