$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$StartupFolder = [Environment]::GetFolderPath("Startup")
$ShortcutPath = Join-Path $StartupFolder "Start TheYep Home Server.cmd"
$LaunchScript = Join-Path $PSScriptRoot "launch-theyep-public.ps1"

$content = @"
@echo off
cd /d "$Root"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$LaunchScript"
"@

Set-Content -LiteralPath $ShortcutPath -Value $content -Encoding ASCII

Write-Host "Startup shortcut created:"
Write-Host $ShortcutPath
