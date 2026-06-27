@echo off
cd /d "C:\Users\tabor\OneDrive\Escritorio\RETO No 2 hackaton2026"
echo.
echo === Commiteando todos los cambios a GitHub ===
echo.
git add -A
git status
echo.
git commit -m "chore: limpieza proyecto - fix next.config, gitignore, remover Firebase files"
git push origin main
echo.
echo === Listo. Vercel re-desplegara automaticamente en ~2 min. ===
pause
