$connections = Get-NetTCPConnection -LocalPort 4100 -State Listen -ErrorAction SilentlyContinue

if (-not $connections) {
  Write-Host "No TheYep server is listening on port 4100."
  exit 0
}

$connections |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object {
    Write-Host "Stopping process $_ on port 4100..."
    Stop-Process -Id $_ -Force
  }
