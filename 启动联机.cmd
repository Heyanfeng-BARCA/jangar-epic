@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 or later is required. Read the included instructions.
  pause
  exit /b 1
)
node server.cjs
pause
