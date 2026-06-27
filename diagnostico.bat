@echo off
cd /d "C:\Users\tabor\OneDrive\Escritorio\RETO No 2 hackaton2026"

echo Corriendo diagnostico... > diagnostico_log.txt 2>&1
echo. >> diagnostico_log.txt

echo [Node] >> diagnostico_log.txt
node --version >> diagnostico_log.txt 2>&1
npm --version >> diagnostico_log.txt 2>&1

echo. >> diagnostico_log.txt
echo [Vercel CLI] >> diagnostico_log.txt
vercel --version >> diagnostico_log.txt 2>&1
where vercel >> diagnostico_log.txt 2>&1

echo. >> diagnostico_log.txt
echo [PowerShell] >> diagnostico_log.txt
powershell -Command "$PSVersionTable.PSVersion" >> diagnostico_log.txt 2>&1

echo. >> diagnostico_log.txt
echo [Test PS1] >> diagnostico_log.txt
powershell -ExecutionPolicy Bypass -Command "Write-Host 'PS OK'; Set-Location 'C:\Users\tabor\OneDrive\Escritorio\RETO No 2 hackaton2026'; Write-Host (Get-Location)" >> diagnostico_log.txt 2>&1

echo. >> diagnostico_log.txt
echo [.env.local existe?] >> diagnostico_log.txt
if exist .env.local (echo SI) else (echo NO) >> diagnostico_log.txt 2>&1

echo Diagnostico completo. Abriendo log...
notepad diagnostico_log.txt
