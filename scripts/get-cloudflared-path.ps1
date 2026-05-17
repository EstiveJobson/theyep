$command = Get-Command cloudflared -ErrorAction SilentlyContinue
if ($command) {
  return $command.Source
}

$wingetCloudflared = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\cloudflared.exe"
if (Test-Path $wingetCloudflared) {
  return $wingetCloudflared
}

throw "cloudflared is not installed. Install it with: winget install Cloudflare.cloudflared"
