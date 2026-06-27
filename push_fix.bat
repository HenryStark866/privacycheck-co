@echo off
cd /d "C:\Users\tabor\OneDrive\Escritorio\RETO No 2 hackaton2026"
echo.
echo === Subiendo correccion next.config.js a GitHub ===
echo.
git add next.config.js
git commit -m "fix: next.config.js serverComponentsExternalPackages para Next.js 14"
git push origin main
echo.
echo === Listo. Vercel re-desplegara automaticamente. ===
pause
