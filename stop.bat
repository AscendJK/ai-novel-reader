@echo off
cd /d "%~dp0"

for %%p in (5173 3001) do (
    powershell -Command "$conn=Get-NetTCPConnection -LocalPort %%p -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if($conn){Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Host ('Stopped port %%p PID '+$conn.OwningProcess)}else{Write-Host ('No server on port %%p')}"
)
echo.
pause
