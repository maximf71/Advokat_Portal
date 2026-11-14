$ErrorActionPreference = "Stop"
$bin = "C:\Program Files\PostgreSQL\17\bin"
$data = Join-Path $PSScriptRoot "..\.pgdata" | Resolve-Path -ErrorAction SilentlyContinue
if (-not $data) {
  Write-Error "Data directory .pgdata not found. Run init first."
}
$status = & "$bin\pg_ctl.exe" -D $data status 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "PostgreSQL already running on port 5433"
  exit 0
}
& "$bin\pg_ctl.exe" -D $data -l (Join-Path $data "server.log") start
Write-Host "PostgreSQL started on 127.0.0.1:5433"
