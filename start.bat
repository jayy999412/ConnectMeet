@echo off
REM =========================================================================
REM  ConnectMeet - start the app on this computer
REM  Double-click this file. Two terminal windows will open:
REM    1) API server     -> http://127.0.0.1:5001
REM    2) Frontend server -> http://localhost:5173
REM  Your browser then opens automatically.
REM =========================================================================

echo Starting ConnectMeet...

start "ConnectMeet API (port 5001)" cmd /k "cd /d %~dp0backend && .\.venv\Scripts\python.exe run.py"

REM Give the API a moment before starting the frontend
timeout /t 3 /nobreak >nul

start "ConnectMeet Frontend (port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 4 /nobreak >nul
start "" http://localhost:5173

echo.
echo   Backend  : http://127.0.0.1:5001
echo   Frontend : http://localhost:5173
echo.
echo   To STOP: close the two black terminal windows.
echo   NOTE: localhost only works on THIS computer. To let someone else
echo   join, run start-share-link.bat instead.
echo.
pause
