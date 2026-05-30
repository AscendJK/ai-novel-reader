@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ===== AI Novel Reader =====
echo.

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    pause
    exit /b 1
)

for /f "tokens=2 delims=v." %%a in ('node -v') do set "NODE_VER=%%a"
if !NODE_VER! geq 24 (
    echo Node.js 24+ is not supported. Please use 18-22 LTS.
    pause
    exit /b 1
)

:menu
echo Select launch mode:
echo   [1] Dev mode
echo   [2] Prod mode
echo   [0] Exit
echo.
set "mode="
set /p "mode=Enter choice: "
if not defined mode set "mode=1"

if "%mode%"=="0" exit /b
if "%mode%"=="1" goto dev
if "%mode%"=="2" goto prod
goto menu

:dev
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
)

start "Server" /MIN node server/index.js
timeout /t 2 /nobreak >nul
start "Vite" /MIN npx vite --host 0.0.0.0
echo.
echo Dev running: http://localhost:5173
echo.
pause
exit /b

:prod
if not exist "node_modules\" (
    echo Installing production dependencies...
    call npm install --production
)
echo Building for production...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed.
    pause
    exit /b 1
)
echo Starting server in background...
rem Create a VBScript to run node in hidden window
echo Set WshShell = CreateObject("WScript.Shell") > "%TEMP%\start-server.vbs"
echo WshShell.Run "cmd /c cd /d ""%~dp0"" && node server/index.js --full", 0, False >> "%TEMP%\start-server.vbs"
cscript //nologo "%TEMP%\start-server.vbs"
del "%TEMP%\start-server.vbs"
timeout /t 3 /nobreak >nul
echo.
echo Prod running: http://localhost:5173
echo.
echo Server is running in the background. Use stop.bat to stop it.
echo.
pause
exit /b