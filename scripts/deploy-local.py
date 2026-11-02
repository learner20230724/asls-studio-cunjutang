#!/usr/bin/env python3
"""Build and atomically publish the static rehearsal app on this server."""
from datetime import datetime, timezone
from pathlib import Path
import os
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
PUBLISH = Path('/var/www/asls-studio-cunjutang')

def main():
    for command in (['npm', 'run', 'templates'], ['npm', 'test'], ['npm', 'run', 'build']):
        subprocess.run(command, cwd=ROOT, check=True)
    release = PUBLISH / 'releases' / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    release.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(ROOT / 'dist', release)
    for path in release.rglob('*'):
        path.chmod(0o755 if path.is_dir() else 0o644)
    release.chmod(0o755)
    temporary = PUBLISH / f'.current-{os.getpid()}'
    try:
        temporary.symlink_to(release, target_is_directory=True)
        temporary.replace(PUBLISH / 'current')
    finally:
        temporary.unlink(missing_ok=True)
    print(f'Published {release}')
    print('https://guihualab.cn/rehearsal/')

if __name__ == '__main__':
    main()
