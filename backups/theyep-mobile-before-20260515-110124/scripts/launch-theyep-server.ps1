$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $Root "server"
$OutLog = Join-Path $LogDir "theyep-server.out.log"
$ErrLog = Join-Path $LogDir "theyep-server.err.log"
$StartScript = Join-Path $PSScriptRoot "start-theyep-server.ps1"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$existing = Get-NetTCPConnection -LocalPort 4100 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existing) {
  Write-Host "TheYep already appears to be listening on port 4100 (PID $($existing.OwningProcess))."
  exit 0
}

Start-Process `
  -FilePath "powershell.exe" `
  -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$StartScript`" -SkipBuild" `
  -WorkingDirectory $Root `
  -WindowStyle Hidden `
  -RedirectStandardOutput $OutLog `
  -RedirectStandardError $ErrLog

Write-Host "TheYep server launched in the background."
Write-Host "Logs:"
Write-Host $OutLog
Write-Host $ErrLog
