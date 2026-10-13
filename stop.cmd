@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop.ps1" %*
set "stop_result=%errorlevel%"
echo.
pause
exit /b %stop_result%
