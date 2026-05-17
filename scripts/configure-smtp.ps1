param(
  [string]$Email = "theyep.team@gmail.com",
  [string]$HostName = "smtp.gmail.com",
  [int]$Port = 587
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $Root ".env.production.local"

if (-not (Test-Path $EnvFile)) {
  throw "Missing environment file: $EnvFile"
}

function Set-EnvValue {
  param(
    [string[]]$Lines,
    [string]$Name,
    [string]$Value
  )

  $escapedValue = $Value -replace "`r|`n", ""
  $pattern = "^\s*$([Regex]::Escape($Name))="
  $replacement = "$Name=$escapedValue"
  $found = $false
  $updated = foreach ($line in $Lines) {
    if ($line -match $pattern) {
      $found = $true
      $replacement
    } else {
      $line
    }
  }

  if (-not $found) {
    $updated += $replacement
  }

  return $updated
}

$securePassword = Read-Host "Cole aqui a senha de app do e-mail $Email" -AsSecureString
$password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
)

if (-not $password) {
  throw "SMTP password was empty."
}

$lines = Get-Content -LiteralPath $EnvFile
$lines = Set-EnvValue $lines "THEYEP_EMAIL_FROM" $Email
$lines = Set-EnvValue $lines "THEYEP_SMTP_HOST" $HostName
$lines = Set-EnvValue $lines "THEYEP_SMTP_PORT" ([string]$Port)
$lines = Set-EnvValue $lines "THEYEP_SMTP_USER" $Email
$lines = Set-EnvValue $lines "THEYEP_SMTP_PASS" $password

Set-Content -LiteralPath $EnvFile -Value $lines -Encoding ASCII

Write-Host "SMTP configured in .env.production.local."
Write-Host "Restart TheYep with: npm.cmd run home:stop; npm.cmd run home:public"
