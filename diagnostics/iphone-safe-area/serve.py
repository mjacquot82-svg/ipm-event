from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]/'frontend/dist'
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def do_GET(self):
  if self.path.split('?')[0]=='/api/vendors': self.path='/api/vendors.json'
  elif not (ROOT/self.path.split('?')[0].lstrip('/')).is_file():self.path='/index.html'
  super().do_GET()
ThreadingHTTPServer(('127.0.0.1',8765),Handler).serve_forever()
