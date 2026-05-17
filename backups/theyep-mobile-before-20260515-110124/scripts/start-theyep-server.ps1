param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $Root ".env.production.local"

function Import-DotEnv {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    throw "Missing environment file: $Path"
  }

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $equalsIndex = $line.IndexOf("=")
    if ($equalsIndex -lt 1) { return }

    $name = $line.Substring(0, $equalsIndex).Trim()
    $value = $line.Substring($equalsIndex + 1).Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

Import-DotEnv $EnvFile

if (-not $env:PORT) { $env:PORT = "4100" }
if (-not $env:HOST) { $env:HOST = "0.0.0.0" }
if (-not $env:THEYEP_SERVE_FRONTEND) { $env:THEYEP_SERVE_FRONTEND = "true" }

Push-Location $Root
try {
  if (-not $SkipBuild) {
    npm.cmd install
    npm.cmd run build
  }

  npm.cmd start
} finally {
  Pop-Location
}
