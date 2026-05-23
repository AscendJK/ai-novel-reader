@echo off
cd /d "%~dp0"

echo ===== AI Novel Reader =====
echo.

REM Check if dependencies are installed
if not exist "node_modules\" (
    echo First run detected. Installing dependencies...
    echo This may take a few minutes.
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: npm install failed. Please make sure Node.js is installed.
        echo Download from: https://nodejs.org
        echo.
        pause
        exit /b 1
    )
    echo.
    echo Dependencies installed successfully!
    echo.
)

REM Kill old process on port 5173
for /f "tokens=5" %%a in ('powershell -Command "Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"') do (
    echo Killing old process PID %%a ...
    taskkill /PID %%a /F >nul 2>&1
)

REM Start hidden in background
powershell -Command "Start-Process -FilePath 'cmd' -ArgumentList '/c cd /d %~dp0 && npx vite --host 0.0.0.0 --port 5173' -WindowStyle Hidden"

timeout /t 3 /nobreak >nul
echo.
echo ==============================
echo   http://localhost:5173
echo   (running in background)
echo ==============================
echo.
echo To stop: run port-mgr.bat ^& choose [3]
echo.
pause
