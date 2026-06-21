@echo off
chcp 65001 >nul
title Expo Pack Tool v1.0

setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "TOOL_DIR=%SCRIPT_DIR%"

:: Find tool directory
if not exist "%TOOL_DIR%src\index.js" (
    if exist "%TOOL_DIR%..\src\index.js" set "TOOL_DIR=%TOOL_DIR%.."
    if exist "%~dp0..\pack-tool\src\index.js" set "TOOL_DIR=%~dp0..\pack-tool"
)

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    cls
    echo ========================================
    echo     [ERROR] Node.js not found
    echo     Please install Node.js 20+
    echo     https://nodejs.org/
    echo ========================================
    pause
    exit /b 1
)

:: Auto install dependencies
if not exist "%TOOL_DIR%node_modules" (
    cls
    echo ========================================
    echo     [*] First run - installing dependencies...
    echo ========================================
    echo.
    cd /d "%TOOL_DIR%"
    call npm install
    if !ERRORLEVEL! neq 0 (
        echo.
        echo [ERROR] npm install failed, check network
        pause
        exit /b 1
    )
)

:: Init config on first run
if not exist "%TOOL_DIR%pack.config.json" (
    cls
    cd /d "%TOOL_DIR%"
    node src/index.js init
    echo.
    echo ========================================
    echo     Please edit pack.config.json
    echo     then run this tool again
    echo ========================================
    pause
    exit /b 0
)

:: Launch Node.js menu (all Chinese text handled by Node)
:main
cls
cd /d "%TOOL_DIR%"

:loop
cls
node src/index.js menu
if %ERRORLEVEL%==100 goto doBuild
if %ERRORLEVEL%==101 goto doExport
if %ERRORLEVEL%==102 goto doApk
if %ERRORLEVEL%==103 goto doHistory
if %ERRORLEVEL%==104 goto doList
if %ERRORLEVEL%==105 goto doStatus
if %ERRORLEVEL%==106 goto doInit
if %ERRORLEVEL%==0 exit /b 0
pause
goto loop

:doBuild
cls
node src/index.js interactive-build
set exitcode=%ERRORLEVEL%
if %exitcode%==0 goto main
if %exitcode%==1 (
    echo.
    echo [ERROR] Build failed - see log above
    pause
    goto main
)
pause
goto main

:doExport
cls
node src/index.js interactive-export
pause
goto main

:doApk
cls
node src/index.js interactive-apk
pause
goto main

:doHistory
cls
node src/index.js interactive-history
pause
goto main

:doList
cls
node src/index.js list
echo.
pause
goto main

:doStatus
cls
node src/index.js interactive-status
pause
goto main

:doInit
cls
node src/index.js init
echo.
echo ========================================
echo     Configuration done!
echo ========================================
pause
goto main