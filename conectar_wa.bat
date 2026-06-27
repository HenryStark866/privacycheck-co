@echo off
title Tunel Seguro WhatsApp y OpenWA - Cavaltec
echo ========================================================
echo   Iniciando Entorno Completo WhatsApp (OpenWA + Tunel)
echo ========================================================
echo.
echo 1. Iniciando el gateway de WhatsApp (OpenWA) localmente...
start "OpenWA Server" cmd /c "cd OpenWA-main && npm run dev"
echo    [OK] Servidor de WhatsApp abriendo en nueva ventana...
echo.
echo 2. Conectando el puerto 2785 a https://cavaltec-wa-gateway-1234.loca.lt
echo.
echo IMPORTANTE: 
echo - Deja esta ventana y la nueva que se abrio ABIERTAS.
echo - Vercel utilizara este tunel para comunicarse con tu equipo.
echo.
echo Presiona Ctrl+C para detener el tunel.
echo.
npx -y localtunnel --port 2785 --subdomain cavaltec-wa-gateway-1234
pause
