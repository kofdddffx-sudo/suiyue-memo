@echo off
chcp 65001 >nul 2>&1
title Universal Expo Pack Tool

setlocal enabledelayedexpansion

:: Get the directory where THIS batch file is located
set "BAT_DIR=%~dp0"
:: Go up one level to get tool root (scripts/../ = pack-tool/)
set "TOOL_DIR=%BAT_DIR%..\"

:: Make path absolute and clean
cd /d "%TOOL_DIR%"

:: Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo Please download from: https://nodejs.org/
    pause
    exit /b 1
)

:: Auto install dependencies
if not exist "node_modules\" (
    echo [*] Installing dependencies (first run)...
    call npm install --no-fund --no-audit
)

:: Launch Node.js main loop - it handles everything
node main.js

:: If Node exits, pause so user can see any error
echo.
pause