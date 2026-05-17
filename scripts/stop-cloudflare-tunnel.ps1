$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $Root "server"
$PidFile = Join-Path $LogDir "cloudflared.pid"

if (-not (Test-Path $PidFile)) {
  Write-Host "No Cloudflare Tunnel PID file found."
  exit 0
}

$pidToStop = Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $pidToStop) {
  Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
  Write-Host "Cloudflare Tunnel PID file was empty."
  exit 0
}

$process = Get-Process -Id $pidToStop -ErrorAction SilentlyContinue
if (-not $process) {
  Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
  Write-Host "Cloudflare Tunnel process $pidToStop is not running."
  exit 0
}

Write-Host "Stopping Cloudflare Tunnel process $pidToStop..."
Stop-Process -Id $pidToStop -Force
Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
