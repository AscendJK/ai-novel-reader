@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo Stopping AI Novel Reader...
echo.

REM Kill processes on port 5173
set "FOUND="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    if not defined FOUND (
        echo Stopping Vite/Server on port 5173 (PID %%a)
        taskkill /PID %%a /F >nul 2>&1
        set "FOUND=1"
    )
)

REM Kill processes on port 3001
set "FOUND="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    if not defined FOUND (
        echo Stopping Server on port 3001 (PID %%a)
        taskkill /PID %%a /F >nul 2>&1
        set "FOUND=1"
    )
)

echo.
echo Done.
pause
endlocal
