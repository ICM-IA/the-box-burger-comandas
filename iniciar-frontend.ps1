# Script de arranque del frontend — The Box Burger
Write-Host "🌐 Iniciando frontend en http://localhost:3000..." -ForegroundColor Green
Set-Location "$PSScriptRoot\frontend"
npx vite --port 3000
