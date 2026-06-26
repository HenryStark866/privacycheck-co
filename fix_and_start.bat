@echo off
cd /d "C:\Users\tabor\OneDrive\Escritorio\RETO No 2 hackaton2026"
echo Borrando cache de Next.js...
rmdir /s /q .next 2>nul
echo Cache borrado. Iniciando servidor...
npm run dev
pause
