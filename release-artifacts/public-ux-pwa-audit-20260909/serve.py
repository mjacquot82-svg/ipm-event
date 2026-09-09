from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import sys
control=Path(sys.argv[1]);port=int(sys.argv[2])
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=control.read_text().strip(),**kw)
 def do_GET(self):
  if self.path.startswith('/api/'):
   self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(b'{"events":[],"announcements":[]}');return
  if not Path(self.translate_path(self.path)).is_file():self.path='/index.html'
  super().do_GET()
 def end_headers(self):self.send_header('Cache-Control','public,max-age=0,must-revalidate');super().end_headers()
 def log_message(self,*a):pass
ThreadingHTTPServer(('127.0.0.1',port),Handler).serve_forever()
