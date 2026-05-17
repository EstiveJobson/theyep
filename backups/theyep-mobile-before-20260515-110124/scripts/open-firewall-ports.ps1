# Run this PowerShell script as Administrator.
$ErrorActionPreference = "Stop"

New-NetFirewallRule `
  -DisplayName "TheYep HTTP" `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 80 `
  -Action Allow `
  -Profile Any `
  -ErrorAction SilentlyContinue

New-NetFirewallRule `
  -DisplayName "TheYep HTTPS" `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 443 `
  -Action Allow `
  -Profile Any `
  -ErrorAction SilentlyContinue

New-NetFirewallRule `
  -DisplayName "TheYep Local App Port" `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 4100 `
  -Action Allow `
  -Profile Private `
  -ErrorAction SilentlyContinue

Write-Host "Firewall rules requested for ports 80, 443, and private LAN port 4100."
