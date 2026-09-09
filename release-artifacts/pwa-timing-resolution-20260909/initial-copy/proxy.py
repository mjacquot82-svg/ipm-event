from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from pathlib import Path
import json,urllib.request,time,hashlib,threading
A=Path(__file__).resolve().parent;cache={};lock=threading.Lock()
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_POST(self):self.send_error(403)
 def do_GET(self):
  cfg=json.loads((A/'proxy-state.json').read_text());phase=cfg.get('phase','A');path=self.path.split('?')[0]
  with lock:
   with (A/'proxy-network.jsonl').open('a') as f:f.write(json.dumps({'at':time.time(),'phase':phase,'path':path,'fault':cfg.get('fault'),'worker':self.headers.get('Service-Worker')})+'\n')
  if path=='/webpushr-sw.js':
   if cfg.get('fault')=='worker-check':self.send_error(503);return
   body=(A/f'{phase}-worker.js').read_bytes();typ='application/javascript'
  else:
   if path in ['/','/index.html','/itinerary','/about']:
    if cfg.get('fault')=='server':self.send_error(503);return
    if cfg.get('fault')=='slow':time.sleep(20)
    path='/index.html'
   upstream='https://'+json.loads((A/f'{phase}-draft.json').read_text())['id']+'--ipm-web-staging.netlify.app'+path
   try:
    if upstream not in cache:
     r=urllib.request.urlopen(upstream,timeout=25);cache[upstream]=(r.read(),r.headers.get('Content-Type','application/octet-stream'))
    body,typ=cache[upstream]
   except Exception:self.send_error(502);return
  self.send_response(200);self.send_header('Content-Type',typ);self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.end_headers()
  try:self.wfile.write(body)
  except (BrokenPipeError,ConnectionResetError):pass
ThreadingHTTPServer(('127.0.0.1',8768),Handler).serve_forever()
