import json,urllib.request,pathlib,sys,re,hashlib
A=pathlib.Path(__file__).resolve().parent
c=json.loads((pathlib.Path.home()/'.config/netlify/config.json').read_text());a=c['users'][c['userId']]['auth'];token=a['token'] if isinstance(a,dict) else a
site='0932cc5d-9cb8-4cd3-8418-7e486df75bf1'
def api(path,method='GET'):
 r=urllib.request.Request('https://api.netlify.com/api/v1'+path,headers={'Authorization':'Bearer '+token},method=method)
 return json.load(urllib.request.urlopen(r,timeout=40))
if sys.argv[1]=='verify':
 results={};bodies={}
 for label in ['A','B','C']:
  d=api('/deploys/'+json.loads((A/f'{label}-draft.json').read_text())['id']);i=json.loads((A/f'{label}-identity.json').read_text());base='https://'+d['id']+'--ipm-web-staging.netlify.app'
  html=urllib.request.urlopen(base+'/index.html',timeout=30).read().decode();assert i['entry'] in html
  body=urllib.request.urlopen(base+i['entry'],timeout=30).read().decode();bodies[label]=body.replace(i['build'],'BUILD')
  worker=urllib.request.urlopen(base+'/webpushr-sw.js',timeout=30).read().decode();assert i['worker'] in worker and 'IPM_LAUNCH_TIMEOUT_MS = 5000' in worker
  results[label]={'id':d['id'],'state':d['state'],**i}
 assert bodies['A']==bodies['B']==bodies['C']
 results['application_bytes_equal_except_build']=True
 (A/'artifact-verification.json').write_text(json.dumps(results,indent=2));print(json.dumps(results))
else:
 label=sys.argv[1];expected=sys.argv[2];current=api('/sites/'+site)['published_deploy']['id'];assert current==expected,(current,expected)
 target=json.loads((A/f'{label}-draft.json').read_text())['id'];assert api('/deploys/'+target)['state']=='ready'
 d=api('/sites/'+site+'/deploys/'+target+'/restore','POST')
 result={k:d.get(k) for k in ['id','state','title','published_at']}
 (A/f'{label}-published.json').write_text(json.dumps(result,indent=2));print(result)
