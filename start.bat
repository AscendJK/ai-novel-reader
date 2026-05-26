@echo off
cd /d "%~dp0"

echo ===== AI Novel Reader =====
echo.

REM Check if npm exists
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo Please install Node.js first: https://nodejs.org
    pause
    exit /b 1
)

REM Check Node.js version
for /f "tokens=1 delims=." %%v in ('node -v') do set "NODE_VER=%%v"
set "NODE_VER=%NODE_VER:v=%"
if %NODE_VER% GEQ 24 (
    echo [ERROR] Node.js version %NODE_VER% is not supported.
    echo.
    echo   better-sqlite3 has no prebuilt binaries for Node.js 24+.
    echo   This project requires Node.js 18-22 LTS.
    echo.
    echo   Fix: Install Node.js 22 LTS
    echo   1. Uninstall current Node.js
    echo   2. Download 22.x.x LTS from https://nodejs.org
    echo   3. Run this script again
    echo.
    echo   Tip: Use nvm to manage multiple Node versions:
    echo   https://github.com/coreybutler/nvm-windows/releases
    echo.
    pause
    exit /b 1
)

REM Install dependencies if needed
if not exist "node_modules\" (
    echo First run: installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Failed to install dependencies.
        echo.
        echo   This is likely because better-sqlite3 could not compile.
        echo   Please install Node.js 22 LTS: https://nodejs.org
        echo.
        pause
        exit /b 1
    )
    echo.
)

echo Select launch mode:
echo   [1] Dev mode  (fast reload, sync server + Vite)
echo   [2] Prod mode (stable, single port, recommended for mobile/LAN)
echo   [0] Exit
echo.
set /p "mode=Enter choice: "

if "%mode%"=="0" exit /b
if "%mode%"=="1" goto dev
if "%mode%"=="2" goto prod
echo Invalid choice, defaulting to dev mode...
goto dev

:dev
REM Kill old processes on ports 5173 and 3001
for %%p in (5173 3001) do (
    for /f "tokens=5" %%a in ('powershell -Command "Get-NetTCPConnection -LocalPort %%p -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"') do (
        echo Stopping old instance on port %%p PID %%a ...
        taskkill /PID %%a /F >nul 2>&1
    )
)
echo Starting sync server (port 3001)...
powershell -Command "Start-Process -FilePath 'cmd' -ArgumentList '/c cd /d %~dp0 && node server/index.js > server\server.log 2>&1' -WindowStyle Hidden"
timeout /t 2 /nobreak >nul
echo Starting Vite dev server (port 5173)...
powershell -Command "Start-Process -FilePath 'cmd' -ArgumentList '/c cd /d %~dp0 && npx vite --host 0.0.0.0 --port 5173' -WindowStyle Hidden"
timeout /t 3 /nobreak >nul
echo ==============================
echo   DEV  http://localhost:5173
echo ==============================
goto end

:prod
for /f "tokens=5" %%a in ('powershell -Command "Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"') do (
    echo Stopping old instance PID %%a ...
    taskkill /PID %%a /F >nul 2>&1
)
echo Building for production...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed.
    pause
    exit /b 1
)
echo Starting production server (port 5173)...
powershell -Command "Start-Process -FilePath 'cmd' -ArgumentList '/c cd /d %~dp0 && node server/index.js --full' -WindowStyle Hidden"
timeout /t 2 /nobreak >nul
echo ==============================
echo   PROD http://localhost:5173
echo ==============================
:end
echo.
echo Stop server: run stop.bat
echo.
pause
