# The Box Burger — Arranque completo
# Uso: powershell -ExecutionPolicy Bypass -File iniciar.ps1

$ROOT   = Split-Path -Parent $MyInvocation.MyCommand.Path
$PG_BIN = "$env:USERPROFILE\scoop\apps\postgresql\current\bin"
$PG_DATA= "$env:USERPROFILE\scoop\apps\postgresql\current\data"

Write-Host ""
Write-Host "=== THE BOX BURGER ===" -ForegroundColor Red
Write-Host ""

# 1. Matar node previos
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

# 2. PostgreSQL en puerto 5433
Write-Host "[1/3] Iniciando PostgreSQL..." -ForegroundColor Cyan
& "$PG_BIN\pg_ctl.exe" -D $PG_DATA -o "-p 5433" -l "$PG_DATA\pg.log" start 2>&1 | Out-Null
Start-Sleep -Seconds 2
& "$PG_BIN\pg_isready.exe" -p 5433 -U postgres -q 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) { Write-Host "    PostgreSQL OK (puerto 5433)" -ForegroundColor Green }
else { Write-Host "    PostgreSQL NO responde" -ForegroundColor Red }

# 3. Backend — abre su propia ventana
Write-Host "[2/3] Iniciando backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\backend'; node src/index.js"
Start-Sleep -Seconds 5
$b = (Test-NetConnection localhost -Port 3001 -WarningAction SilentlyContinue).TcpTestSucceeded
if ($b) { Write-Host "    Backend OK (puerto 3001)" -ForegroundColor Green }
else     { Write-Host "    Backend NO responde — revisa la ventana de backend" -ForegroundColor Red }

# 4. Frontend — abre su propia ventana
Write-Host "[3/3] Iniciando frontend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\frontend'; npx vite --port 3000"
Start-Sleep -Seconds 7
$f = (Test-NetConnection localhost -Port 3000 -WarningAction SilentlyContinue).TcpTestSucceeded
if ($f) { Write-Host "    Frontend OK (puerto 3000)" -ForegroundColor Green }
else    { Write-Host "    Frontend NO responde — revisa la ventana de frontend" -ForegroundColor Red }

Write-Host ""
Write-Host "    http://localhost:3000" -ForegroundColor Green
Write-Host "    admin@theboxburger.com / admin123" -ForegroundColor Yellow
Write-Host ""

Start-Process "http://localhost:3000"
