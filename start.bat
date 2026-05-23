@echo off
cd /d "%~dp0"

echo ===== AI Novel Reader =====
echo.

REM Check if npm exists
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo.
    echo Please install Node.js first:
    echo   https://nodejs.org
    echo.
    echo Download the LTS version, install it,
    echo then restart this script.
    echo.
    pause
    exit /b 1
)

REM Install dependencies if needed
if not exist "node_modules\" (
    echo First run: installing dependencies...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Failed to install dependencies.
        echo Check your network connection and try again.
        pause
        exit /b 1
    )
    echo Dependencies installed.
    echo.
)

REM Kill old process on port 5173
for /f "tokens=5" %%a in ('powershell -Command "Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"') do (
    echo Stopping old instance PID %%a ...
    taskkill /PID %%a /F >nul 2>&1
)

REM Start hidden
powershell -Command "Start-Process -FilePath 'cmd' -ArgumentList '/c cd /d %~dp0 && npx vite --host 0.0.0.0 --port 5173' -WindowStyle Hidden"

timeout /t 3 /nobreak >nul
echo ==============================
echo   http://localhost:5173
echo ==============================
echo.
echo Stop server: port-mgr.bat -^> [3]
echo.
pause
