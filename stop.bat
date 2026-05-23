@echo off
cd /d "%~dp0"

echo Stopping server on port 5173...
powershell -Command "$conn=Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if($conn){try{Stop-Process -Id $conn.OwningProcess -Force -ErrorAction Stop; Write-Host ('Stopped PID '+$conn.OwningProcess)}catch{Write-Host ('Warn: '+$_.Exception.Message)}}else{Write-Host 'No server running on port 5173'}"
echo.
pause
