$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $Root "server"
$OutLog = Join-Path $LogDir "cloudflared.out.log"
$ErrLog = Join-Path $LogDir "cloudflared.err.log"
$PidFile = Join-Path $LogDir "cloudflared.pid"
$ConfigFile = Join-Path $env:USERPROFILE ".cloudflared\config.yml"
$Cloudflared = & (Join-Path $PSScriptRoot "get-cloudflared-path.ps1")

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

if (-not (Test-Path $ConfigFile)) {
  throw "Cloudflare Tunnel config not found at $ConfigFile"
}

if (Test-Path $PidFile) {
  $existingPid = Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($existingPid -and (Get-Process -Id $existingPid -ErrorAction SilentlyContinue)) {
    Write-Host "Cloudflare Tunnel already appears to be running (PID $existingPid)."
    exit 0
  }
}

$process = Start-Process `
  -FilePath $Cloudflared `
  -ArgumentList "tunnel --config `"$ConfigFile`" run theyep-home" `
  -WorkingDirectory $Root `
  -WindowStyle Hidden `
  -RedirectStandardOutput $OutLog `
  -RedirectStandardError $ErrLog `
  -PassThru

Set-Content -LiteralPath $PidFile -Value $process.Id -Encoding ASCII

Write-Host "Cloudflare Tunnel launched in the background (PID $($process.Id))."
Write-Host "Logs:"
Write-Host $OutLog
Write-Host $ErrLog
