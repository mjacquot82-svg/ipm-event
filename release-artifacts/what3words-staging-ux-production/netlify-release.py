"""Exact-package manual release. No environment edits or backend deployment."""
import hashlib,json,sys,urllib.request,urllib.parse
from pathlib import Path
A=Path(__file__).resolve().parent
SITE='c64b53c9-5b39-441c-910a-dc00db77b4a5'
BEFORE='6aa0bd481c247632e1a18d16'
c=json.loads((Path.home()/'.config/netlify/config.json').read_text())
auth=c['users'][c['userId']]['auth'];token=auth['token'] if isinstance(auth,dict) else auth
def request(path,method='GET',body=None,content='application/json'):
 data=json.dumps(body).encode() if body is not None and content=='application/json' else body
 req=urllib.request.Request('https://api.netlify.com/api/v1'+path,data=data,method=method,headers={'Authorization':'Bearer '+token,'Content-Type':content})
 with urllib.request.urlopen(req,timeout=60) as r:return json.load(r)
def save(name,d):
 clean={k:d.get(k) for k in ['id','site_id','state','title','published_at','created_at','deploy_ssl_url','commit_ref','error_message']}
 (A/name).write_text(json.dumps(clean,indent=2)+'\n');return clean
mode=sys.argv[1]
if mode=='draft':
 assert request('/sites/'+SITE)['published_deploy']['id']==BEFORE,'Production changed; stop'
 files={};blobs={}
 for p in (A/'frontend-release').rglob('*'):
  if not p.is_file():continue
  path='/'+str(p.relative_to(A/'frontend-release'));data=p.read_bytes();sha=hashlib.sha1(data).hexdigest()
  assert path.lower() not in files or files[path.lower()]==sha
  files[path.lower()]=sha;blobs[sha]=(path,data)
 source=json.loads((A/'release-manifest.json').read_text())['source_sha']
 assert len(source)==40
 d=request('/sites/'+SITE+'/deploys','POST',dict(files=files,draft=True,title='Exact staging Emergency UX '+source,branch='fix/what3words-staging-ux-production'))
 print(save('netlify-draft.json',d),flush=True)
 for sha in d.get('required',[]):
  path,data=blobs[sha];request('/deploys/'+d['id']+'/files'+urllib.parse.quote(path),'PUT',data,'application/octet-stream')
 print('Uploaded exact package',d['id'],flush=True)
elif mode=='status':
 d=json.loads((A/'netlify-draft.json').read_text());print(save('netlify-draft-ready.json',request('/deploys/'+d['id'])))
elif mode=='publish':
 d=json.loads((A/'netlify-draft.json').read_text())
 assert request('/sites/'+SITE)['published_deploy']['id']==BEFORE,'Production changed; stop'
 assert request('/deploys/'+d['id'])['state']=='ready'
 gates=json.loads((A/'release-gates.json').read_text());assert gates['all_required_gates_passed']
 print(save('netlify-published.json',request('/sites/'+SITE+'/deploys/'+d['id']+'/restore','POST')))
else:raise SystemExit('Unknown mode')
