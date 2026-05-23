@echo off
cd /d "%~dp0"

echo Stopping server on port 5173...
powershell -Command "$c=Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue; if($c){Stop-Process -Id $c.OwningProcess -Force; echo 'Stopped PID '+$c.OwningProcess}else{echo 'No server running on port 5173'}"
echo.
pause
