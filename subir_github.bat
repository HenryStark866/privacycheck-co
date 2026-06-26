@echo off
cd /d "C:\Users\tabor\OneDrive\Escritorio\RETO No 2 hackaton2026"

echo.
echo === PrivacyCheck CO — Subir a GitHub ===
echo.

:: Eliminar lock si existe
if exist .git\index.lock (
    echo Eliminando index.lock...
    del /f .git\index.lock
)

:: Configurar identidad
git config user.email "henrytaborda57@gmail.com"
git config user.name "HenryStark866"

:: Asegurar remote correcto
git remote set-url origin https://github.com/HenryStark866/privacycheck-co.git 2>nul || git remote add origin https://github.com/HenryStark866/privacycheck-co.git

:: Limpiar index y re-add con .gitignore actualizado
git rm -r --cached . -q 2>nul
git add .

:: Commit
git commit -m "feat: PrivacyCheck CO v1 - Ley 1581 autodiagnostico CAVALTEC"

:: Push
echo.
echo Subiendo a GitHub...
echo Cuando pida contrasena, usa tu Personal Access Token (ghp_...)
echo.
git push -u origin main

echo.
echo === Listo. Revisa https://github.com/HenryStark866/privacycheck-co ===
pause
