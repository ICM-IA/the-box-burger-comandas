# Script de arranque del backend — The Box Burger
$PG_DATA = "$env:USERPROFILE\scoop\apps\postgresql\current\data"
$PG_BIN  = "$env:USERPROFILE\scoop\apps\postgresql\current\bin"

# Asegurar que el PATH incluye scoop
$env:PATH = "$env:USERPROFILE\scoop\shims;$PG_BIN;$env:PATH"

Write-Host "🚀 Iniciando PostgreSQL..." -ForegroundColor Cyan
& "$PG_BIN\pg_ctl.exe" -D $PG_DATA -l "$PG_DATA\postgresql.log" start 2>&1 | Out-Null
Start-Sleep -Seconds 2

Write-Host "🍔 Iniciando backend The Box Burger en puerto 3001..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\backend"
node src/index.js
