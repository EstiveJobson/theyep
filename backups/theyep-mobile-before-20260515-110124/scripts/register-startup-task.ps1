$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$StartScript = Join-Path $PSScriptRoot "start-theyep-server.ps1"
$CaddyScript = Join-Path $PSScriptRoot "start-caddy.ps1"
$ServerTaskName = "TheYep Home Server"
$CaddyTaskName = "TheYep Caddy Proxy"

$Action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$StartScript`" -SkipBuild" `
  -WorkingDirectory $Root
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
  -TaskName $ServerTaskName `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -Description "Starts the TheYep local production server on login." `
  -Force | Out-Null

$CaddyAction = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$CaddyScript`"" `
  -WorkingDirectory $Root

Register-ScheduledTask `
  -TaskName $CaddyTaskName `
  -Action $CaddyAction `
  -Trigger $Trigger `
  -Settings $Settings `
  -Description "Starts Caddy for TheYep HTTPS/domain proxy on login." `
  -Force | Out-Null

Write-Host "Startup tasks registered:"
Write-Host "- $ServerTaskName"
Write-Host "- $CaddyTaskName"
