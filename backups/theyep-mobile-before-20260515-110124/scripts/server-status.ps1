$localIps = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.IPAddress -notlike "169.254*" } |
  Select-Object InterfaceAlias, IPAddress, PrefixLength

$publicIp = try {
  (Invoke-RestMethod -Uri "https://api.ipify.org?format=json" -TimeoutSec 10).ip
} catch {
  "Could not detect public IP: $($_.Exception.Message)"
}

$listeners = Get-NetTCPConnection -LocalPort 4100 -State Listen -ErrorAction SilentlyContinue |
  Select-Object LocalAddress, LocalPort, State, OwningProcess
$caddyListeners = Get-NetTCPConnection -LocalPort 80,443 -State Listen -ErrorAction SilentlyContinue |
  Select-Object LocalAddress, LocalPort, State, OwningProcess
$cloudflaredPidFile = Join-Path (Join-Path (Split-Path -Parent $PSScriptRoot) "server") "cloudflared.pid"
$cloudflaredPid = if (Test-Path $cloudflaredPidFile) { Get-Content -LiteralPath $cloudflaredPidFile -ErrorAction SilentlyContinue | Select-Object -First 1 } else { $null }
$cloudflaredProcess = if ($cloudflaredPid) { Get-Process -Id $cloudflaredPid -ErrorAction SilentlyContinue } else { $null }
$dnsNs = try {
  Resolve-DnsName theyep.com.br -Type NS -Server 8.8.8.8 -ErrorAction Stop |
    Where-Object { $_.NameHost } |
    Select-Object -ExpandProperty NameHost
} catch {
  @("Could not resolve NS: $($_.Exception.Message)")
}
$dnsA = try {
  Resolve-DnsName theyep.com.br -Type A -Server 8.8.8.8 -ErrorAction Stop |
    Where-Object { $_.IPAddress } |
    Select-Object -ExpandProperty IPAddress
} catch {
  @("No public A answer: $($_.Exception.Message)")
}

Write-Host "TheYep home server status"
Write-Host "-------------------------"
Write-Host ""
Write-Host "Local network IP(s):"
$localIps | Format-Table | Out-String | Write-Host
Write-Host "Public IP:"
Write-Host $publicIp
Write-Host ""
Write-Host "Port 4100 listener:"
if ($listeners) {
  $listeners | Format-Table | Out-String | Write-Host
} else {
  Write-Host "Nothing is listening on port 4100."
}
Write-Host ""
Write-Host "Cloudflare Tunnel:"
if ($cloudflaredProcess) {
  Write-Host "Running (PID $($cloudflaredProcess.Id))."
} else {
  Write-Host "Not running from the saved TheYep PID file."
}
Write-Host "Tunnel ID: 4995cafb-9f7a-4e42-93c2-31c9f255e11f"
Write-Host ""
Write-Host "Public DNS currently seen by Google:"
Write-Host "NS:"
$dnsNs | ForEach-Object { Write-Host "  $_" }
Write-Host "A:"
$dnsA | ForEach-Object { Write-Host "  $_" }
Write-Host ""
Write-Host "Caddy/legacy port listeners:"
if ($caddyListeners) {
  $caddyListeners | Format-Table | Out-String | Write-Host
} else {
  Write-Host "Nothing is listening on 80/443."
}
Write-Host ""
Write-Host "Current public route goal:"
Write-Host "Registro.br nameservers -> Cloudflare DNS -> Cloudflare Tunnel -> 127.0.0.1:4100"
