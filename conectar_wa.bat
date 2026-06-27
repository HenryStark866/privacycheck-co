@echo off
title Tunel Seguro WhatsApp - Cavaltec
echo ========================================================
echo   Iniciando Tunel Publico para WhatsApp (OpenWA)
echo ========================================================
echo.
echo Conectando el puerto 2785 a https://cavaltec-wa-gateway-1234.loca.lt
echo.
echo IMPORTANTE: 
echo 1. Debes dejar esta ventana ABIERTA para que Vercel se comunique con tu equipo.
echo 2. El servicio de WhatsApp (npm run dev en OpenWA-main) tambien debe estar corriendo.
echo.
echo Presiona Ctrl+C para detener el tunel.
echo.
npx -y localtunnel --port 2785 --subdomain cavaltec-wa-gateway-1234
pause
