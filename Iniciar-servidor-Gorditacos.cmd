@echo off
setlocal
cd /d "%~dp0"
where.exe node.exe >nul 2>&1
if errorlevel 1 (
  echo Node.js debe estar disponible en PATH.
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  echo Falta la carpeta dist compilada de Gorditacos.
  pause
  exit /b 1
)
set "GORDITACOS_PORT=4173"
echo Conserva abierta esta ventana mientras revisas Gorditacos.
node.exe "scripts\preview.mjs"
if errorlevel 1 pause
