"""Package a local production build while preserving verified deployed assets."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

parser = argparse.ArgumentParser()
parser.add_argument('--build', type=Path, required=True)
parser.add_argument('--baseline', type=Path, required=True)
parser.add_argument('--manifest', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
a = parser.parse_args()
if a.output.exists():
    raise SystemExit('Output must be a new directory')
manifest = json.loads(a.manifest.read_text())
original = {'/' + str(p.relative_to(a.baseline)).lower(): p
            for p in a.baseline.rglob('*') if p.is_file()}
for item in manifest:
    p = original.get(item['path'].lower())
    if p is None or hashlib.sha1(p.read_bytes()).hexdigest() != item['sha']:
        raise SystemExit('Baseline asset validation failed')
shutil.copytree(a.build, a.output)
for item in manifest:
    src = original[item['path'].lower()]
    dst = a.output / src.relative_to(a.baseline)
    if item['path'] in ('/index.html', '/webpushr-sw.js'):
        continue
    if dst.exists() and dst.read_bytes() != src.read_bytes():
        raise SystemExit('Unexpected unrelated production asset change')
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dst)
for item in manifest:
    if item['path'] not in ('/index.html', '/webpushr-sw.js'):
        src = original[item['path'].lower()]
        assert (a.output / src.relative_to(a.baseline)).read_bytes() == src.read_bytes()
print(json.dumps({'baseline_assets': len(manifest), 'preserved_assets': len(manifest)-2,
                  'diagnostics_preserved': all((a.output / p).is_file() for p in
                   ('api/production-push-diagnostic.html','api/production-push-compare.mjs'))}))
