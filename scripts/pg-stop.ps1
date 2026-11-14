$ErrorActionPreference = "Stop"
$bin = "C:\Program Files\PostgreSQL\17\bin"
$data = Join-Path $PSScriptRoot "..\.pgdata" | Resolve-Path
& "$bin\pg_ctl.exe" -D $data stop
Write-Host "PostgreSQL stopped"
