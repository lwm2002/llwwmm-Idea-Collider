@echo off
setlocal
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js and npm are required. Please install Node.js 22.12 or later.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Idea Collider: http://127.0.0.1:5173/
call npm run dev -- --port 5173 --strictPort
pause
