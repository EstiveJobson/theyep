$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Caddyfile = Join-Path $Root "Caddyfile"
$LogDir = Join-Path $Root "server"
$OutLog = Join-Path $LogDir "caddy.out.log"
$ErrLog = Join-Path $LogDir "caddy.err.log"
$Caddy = Get-Command caddy -ErrorAction SilentlyContinue
$WingetCaddy = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages\CaddyServer.Caddy_Microsoft.Winget.Source_8wekyb3d8bbwe\caddy.exe"

if (-not $Caddy -and -not (Test-Path $WingetCaddy)) {
  throw "Caddy is not installed. Install it with: winget install CaddyServer.Caddy"
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

Start-Process `
  -FilePath $(if ($Caddy) { $Caddy.Source } else { $WingetCaddy }) `
  -ArgumentList "run --config `"$Caddyfile`" --adapter caddyfile" `
  -WorkingDirectory $Root `
  -WindowStyle Hidden `
  -RedirectStandardOutput $OutLog `
  -RedirectStandardError $ErrLog

Write-Host "Caddy launched in the background."
Write-Host "Logs:"
Write-Host $OutLog
Write-Host $ErrLog
