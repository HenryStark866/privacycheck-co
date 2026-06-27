@echo off
title PrivacyCheck CO - WhatsApp Gateway + Tunel (auto)
echo ============================================================
echo   PrivacyCheck CO  -  Arranque automatico de WhatsApp
echo ============================================================
echo.
echo  [1/2] Iniciando OpenWA (gateway WhatsApp) en el puerto 2785...
echo        Se abrira una ventana nueva. NO la cierres durante la demo.
start "OpenWA Gateway - NO CERRAR" cmd /k "cd /d ""%~dp0OpenWA-main"" && npm run start:prod"
echo.
echo        Esperando a que OpenWA arranque (20s)...
timeout /t 20 /nobreak >nul
echo.
echo  [2/2] Iniciando tunel publico ESTABLE:
echo        https://cavaltec-wa-gateway-1234.loca.lt
echo        (se reinicia solo si se cae - NO cierres esta ventana)
echo.
echo ------------------------------------------------------------
echo  TODO LISTO. Deja AMBAS ventanas abiertas durante la demo.
echo  Vercel se comunica con tu PC por este tunel.
echo ------------------------------------------------------------
echo.

:tunnel
npx -y localtunnel --port 2785 --subdomain cavaltec-wa-gateway-1234
echo.
echo  [!] El tunel se cerro o se cayo. Reconectando en 3s con la MISMA URL...
timeout /t 3 /nobreak >nul
goto tunnel
