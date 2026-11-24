@echo off
REM =========================================================================
REM  ConnectMeet - create a temporary public link so OTHER people can join
REM  (free Cloudflare quick tunnel - no account needed)
REM
REM  Prerequisites: run start.bat FIRST (both servers must be running).
REM  Keep THIS window open while your friend is joining - the link dies
REM  when you close it, and a new link is created each time you run it.
REM =========================================================================

set "CF=%LOCALAPPDATA%\Temp\opencode\cloudflared.exe"

if not exist "%CF%" (
  echo Downloading cloudflared (one time)...
  powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%CF%'"
)

echo.
echo Starting share link... look below for the https:// address:
echo.
"%CF%" tunnel --url http://localhost:5173
echo.
echo Tunnel closed. Run this file again to get a new link.
pause
