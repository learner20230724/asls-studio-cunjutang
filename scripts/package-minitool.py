from pathlib import Path
import zipfile,subprocess,re,json,hashlib
root=Path(__file__).resolve().parents[1]
dist=root/'dist-minitool'; out=root/'delivery';out.mkdir(exist_ok=True)
assert (dist/'index.html').exists()
allowed={'.html','.js','.css','.json','.png','.jpg','.jpeg','.gif','.svg','.webp','.woff','.woff2'}
for p in dist.rglob('*'):
 if p.is_file():
  assert p.suffix in allowed,p
  if p.suffix in {'.js','.html','.css'}:
   s=p.read_text()
   for token in ['localStorage','sessionStorage','XMLHttpRequest','fetch(','new Function(','type="module"','存菊堂']:
    assert token not in s,(p,token)
html=(dist/'index.html').read_text()
for ref in re.findall(r'(?:src|href)="([^"]+)"',html):assert ref.startswith('./') and (dist/ref).is_file(),ref
assert not re.search(r'<script[^>]*>\s*[^<\s]',html)
archive=out/'lightstage-minitool-1.0.0.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,9) as z:
 for p in sorted(dist.rglob('*')):
  if p.is_file():z.write(p,p.relative_to(dist))
audit=root/'.codex/minitool-zip-builder/scripts/audit_artifact.py'
for p in [dist,archive]:subprocess.run(['python3',str(audit),str(p)],check=True)
report={'version':'1.0.0','zip':str(archive),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':[str(p.relative_to(dist)) for p in dist.rglob('*') if p.is_file()],'unit_tests':41,'native_platform_validation':'pending','android_device_validation':'pending','ios_device_validation':'pending','browser_evidence':json.loads((root/'output/minitool-browser-check.json').read_text())}
(out/'validation-summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
