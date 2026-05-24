@echo off
cd /d "%~dp0"

echo ===== AI Novel Reader - Admin =====
echo.

where node >nul 2>&1
if %errorlevel% neq 0 ( echo [ERROR] Node.js not found. && pause && exit /b 1 )

if not exist "node_modules\" ( echo Installing deps... && call npm install )

if exist "dist\index.html" (
    echo Mode: Production
    powershell -Command "$c=Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select -First 1; if(-not $c){ Start-Process -FilePath 'cmd' -ArgumentList '/c node server/index.js --full' -WindowStyle Hidden; Start-Sleep 2 }"
) else (
    echo Mode: Development
    powershell -Command "$c=Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | Select -First 1; if(-not $c){ Start-Process -FilePath 'cmd' -ArgumentList '/c node server/index.js' -WindowStyle Hidden; Start-Sleep 1 }"
    powershell -Command "$c=Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select -First 1; if(-not $c){ Start-Process -FilePath 'cmd' -ArgumentList '/c npx vite --host 0.0.0.0 --port 5173' -WindowStyle Hidden; Start-Sleep 2 }"
)

set TOKEN=
if exist "server\data\.admin_token" set /p TOKEN=<"server\data\.admin_token"
set URL=http://localhost:5173/admin?token=%TOKEN%
echo Opening: %URL%
start "" "%URL%"
echo Token: %TOKEN%
pause
