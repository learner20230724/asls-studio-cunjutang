$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Please install Node.js 22 or newer first.' }
if (-not (Test-Path -LiteralPath 'node_modules')) { & npm.cmd ci --no-audit --no-fund; if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' } }
& npm.cmd run templates
if ($LASTEXITCODE -ne 0) { throw 'Template generation failed' }
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
& node scripts/serve.mjs --port 4179
