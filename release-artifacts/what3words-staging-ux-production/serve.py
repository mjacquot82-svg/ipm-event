from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import sys
root = Path(sys.argv[1]).resolve()
class SPA(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(root),**kwargs)
 def do_GET(self):
  if not Path(self.translate_path(self.path)).exists(): self.path="/index.html"
  return super().do_GET()
ThreadingHTTPServer(("127.0.0.1",8101),SPA).serve_forever()
