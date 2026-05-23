@echo off
cd /d "%~dp0"

:menu
cls
echo ============================================
echo   AI Novel Reader - Port Manager
echo ============================================
echo.
echo   [1] List ports 5170-5179
echo   [2] Start server on port 5173
echo   [3] Kill a port
echo   [4] Kill all 5170-5179
echo   [0] Exit
echo.
set "choice="
set /p "choice=Select: "

if "%choice%"=="1" goto list
if "%choice%"=="2" goto start
if "%choice%"=="3" goto kill_one
if "%choice%"=="4" goto kill_all
if "%choice%"=="0" exit /b
goto menu

:list
cls
echo.
echo Listening ports (5170-5179):
echo ----------------------------------------
powershell -Command "Get-NetTCPConnection -LocalPort 5170,5171,5172,5173,5174,5175,5176,5177,5178,5179 -ErrorAction SilentlyContinue | Select-Object LocalPort, OwningProcess | Format-Table -AutoSize"
echo ----------------------------------------
echo.
pause
goto menu

:start
cls
echo.
echo Checking port 5173...
powershell -Command "$p=Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue; if($p){Stop-Process -Id $p.OwningProcess -Force; echo 'Old process killed'}"
echo Starting server...
start "AI-Novel-5173" cmd /c "cd /d %~dp0 && npx vite --host 0.0.0.0 --port 5173"
timeout /t 2 /nobreak >nul
echo.
echo ==============================
echo   http://localhost:5173
echo ==============================
echo.
pause
goto menu

:kill_one
cls
set "p="
set /p "p=Port number to kill: "
if "%p%"=="" goto menu
powershell -Command "$conn=Get-NetTCPConnection -LocalPort %p% -ErrorAction SilentlyContinue; if($conn){Stop-Process -Id $conn.OwningProcess -Force; echo 'Port %p% killed'}else{echo 'Port %p% not listening'}"
echo.
pause
goto menu

:kill_all
cls
echo Killing all ports 5170-5179...
powershell -Command "5170..5179 | ForEach-Object { $c=Get-NetTCPConnection -LocalPort $_ -ErrorAction SilentlyContinue; if($c){Stop-Process -Id $c.OwningProcess -Force; echo ('Killed port '+$_+' PID '+$c.OwningProcess)} }"
echo Done
pause
goto menu
