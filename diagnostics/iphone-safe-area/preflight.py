import re,json,subprocess,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[2]
dist=root/'frontend/dist'
html=(dist/'index.html').read_text();worker=(dist/'webpushr-sw.js').read_text()
assert 'viewport-fit=cover' in html and 'black-translucent' in html
assets=json.loads(re.search(r'const IPM_SHELL_ASSETS = (\[.*?\]);',worker,re.S)[1])
for asset in assets:
 if asset!='/':assert (dist/asset.lstrip('/')).is_file(),asset
entry=json.loads((dist/'app-release.json').read_text())['entry']
assert entry in assets and entry in html
bundle=(dist/entry.lstrip('/')).read_text()
assert 'ipm-backend-eoiw.onrender.com' in bundle and 'ipm-staging-backend.onrender.com' not in bundle
assert 'Resume update test:' not in bundle
source=(root/'frontend/public/webpushr-sw.js').read_text()
def norm(s):
 s=re.sub(r"const IPM_OFFLINE_VERSION = '[^']*';",'VERSION',s)
 return re.sub(r'const IPM_SHELL_ASSETS = \[.*?\];','ASSETS',s,flags=re.S)
assert norm(source)==norm(worker),'Generated worker logic differs'
assert (dist/'_redirects').read_text().find('/api/vendors')>=0
assert len(json.loads((dist/'api/vendors.json').read_text())['vendors'])==224
changed=subprocess.check_output(['git','diff','3960f073e204935c6bccd251a1931c00120c2459','--name-only','--','frontend/app','frontend/src','frontend/public','frontend/scripts'],cwd=root,text=True).splitlines()
assert changed==['frontend/app/(tabs)/_layout.tsx'],changed
print(f'PASS: {len(assets)} offline shell assets exist; entry matches HTML/release manifest; production backend; no staging markers; worker logic unchanged; 224 vendor static payload; only tab layout runtime source changed.')
