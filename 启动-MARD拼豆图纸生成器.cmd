@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to run the MARD Bead Generator locally.
  echo Install Node.js from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js and run this file again.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo Installing project dependencies for the first local run...
  call npm ci
  if errorlevel 1 (
    echo Dependency installation failed. Check the message above and try again.
    pause
    exit /b 1
  )
)

echo Starting the MARD Bead Generator on this computer only...
echo Your browser will open automatically when it is ready.
echo Keep this window open while using the generator.
echo Close this window or press Ctrl+C to stop it.
echo.

call npm run dev -- --host 127.0.0.1 --open
set "MARD_EXIT_CODE=%ERRORLEVEL%"

if not "%MARD_EXIT_CODE%"=="0" (
  echo.
  echo The local server stopped with an error.
  pause
)

exit /b %MARD_EXIT_CODE%
