@echo off
echo ==========================================
echo    Kribble Mobile Testing Tunnel
echo ==========================================
echo.

REM Check if ngrok is installed
where ngrok >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] ngrok not found!
    echo Please install ngrok:
    echo   choco install ngrok
    echo   OR download from https://ngrok.com/download
    echo.
    pause
    exit /b 1
)

echo [INFO] Starting ngrok tunnel on port 3001...
echo [INFO] Once ngrok starts, copy the HTTPS URL
echo.

start powershell -NoExit -Command "ngrok http 3001"

echo [INFO] Ngrok window opened!
echo.
echo Next steps:
echo   1. Copy the HTTPS URL from ngrok window
echo   2. Update client/.env.development.local:
echo      VITE_API_URL=https://your-url.ngrok.io
echo      VITE_SOCKET_URL=https://your-url.ngrok.io
echo   3. Restart your frontend dev server
echo   4. Access from phone using your PC's local IP:5173
echo.

REM Get local IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set "ip=%%a"
    goto :found_ip
)
:found_ip
set "ip=%ip: =%"
echo [INFO] Your local IP: %ip%:5173

echo.
pause
