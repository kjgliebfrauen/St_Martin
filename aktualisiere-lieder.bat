@echo off
setlocal

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0aktualisiere-lieder.ps1"
if errorlevel 1 (
  echo.
  echo Aktualisierung fehlgeschlagen.
  pause
  exit /b 1
)

echo.
echo Fertig. Die Lieduebersicht ist jetzt offline auf index.html verfuegbar.
pause
