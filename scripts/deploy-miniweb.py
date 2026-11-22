from pathlib import Path
from datetime import datetime,timezone
import subprocess,shutil,os
root=Path(__file__).resolve().parents[1]
subprocess.run(['npm','run','build:miniweb'],cwd=root,check=True)
base=root/'published';base.mkdir(exist_ok=True)
release=base/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');shutil.copytree(root/'dist-miniweb',release)
tmp=base/('.current-'+str(os.getpid()));tmp.symlink_to(release);os.replace(tmp,base/'current')
print('Published https://guihualab.cn/lightstage/ to',release)
