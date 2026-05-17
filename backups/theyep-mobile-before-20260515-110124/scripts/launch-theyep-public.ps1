$ErrorActionPreference = "Stop"
$LaunchServer = Join-Path $PSScriptRoot "launch-theyep-server.ps1"
$LaunchTunnel = Join-Path $PSScriptRoot "launch-cloudflare-tunnel.ps1"

& $LaunchServer
& $LaunchTunnel

Write-Host ""
Write-Host "TheYep public stack requested."
Write-Host "App: http://127.0.0.1:4100"
Write-Host "Domain after DNS migration: https://theyep.com.br"
