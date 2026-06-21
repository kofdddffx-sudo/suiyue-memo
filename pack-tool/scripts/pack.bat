@echo off
chcp 65001 >nul
title 通用 Expo 打包工具 v1.0

:: =============================================
:: 通用 Expo 打包工具 - Windows 一键启动脚本
:: 用法: 双击运行即可，按菜单提示操作
:: 可放在任何位置，会自动检测 pack-tool 目录
:: =============================================

setlocal enabledelayedexpansion

:: 获取脚本自身所在目录
set "SCRIPT_DIR=%~dp0"
set "TOOL_DIR=%SCRIPT_DIR%"

:: 颜色输出
set "GREEN=[92m"
set "YELLOW=[93m"
set "RED=[91m"
set "BLUE=[94m"
set "RESET=[0m"

cls
echo.
echo   %BLUE%╔══════════════════════════════════════╗%RESET%
echo   %BLUE%║     通用 Expo 打包工具 v1.0          ║%RESET%
echo   %BLUE%║     通用打包，多项目支持              ║%RESET%
echo   %BLUE%╚══════════════════════════════════════╝%RESET%
echo.

:: 检查 Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo   %RED%[!] 未找到 Node.js，请先安装: https://nodejs.org/%RESET%
    pause
    exit /b 1
)

:: 检查 pack-tool 目录
if not exist "%TOOL_DIR%src\index.js" (
    echo   %RED%[!] 未找到 pack-tool 核心文件%RESET%
    echo       请确保脚本放在 pack-tool 目录下
    pause
    exit /b 1
)

:: 检查配置
if not exist "%TOOL_DIR%pack.config.json" (
    echo   %YELLOW%[?] 首次使用，正在初始化配置...%RESET%
    cd /d "%TOOL_DIR%"
    node src/index.js init
    echo.
    echo   请先编辑 pack.config.json，添加你的项目配置
    pause
    exit /b 0
)

:: =============================================
:: 主菜单
:: =============================================
:menu
cls
echo.
echo   %BLUE%╔══════════════════════════════════════╗%RESET%
echo   %BLUE%║         打包工具主菜单               ║%RESET%
echo   %BLUE%╚══════════════════════════════════════╝%RESET%
echo.
echo     [1] 一键打包 EAS Build
echo     [2] 导出项目源码压缩包
echo     [3] 查看/管理 APK 文件
echo     [4] 查看构建历史
echo     [5] 列出已配置项目
echo     [6] 查看 EAS 构建状态
echo     [7] 初始化/重新配置
echo     [0] 退出
echo.
set /p choice="  请输入选项 [0-7]: "

if "%choice%"=="1" goto choose_project_build
if "%choice%"=="2" goto choose_project_export
if "%choice%"=="3" goto choose_project_apk
if "%choice%"=="4" goto choose_project_history
if "%choice%"=="5" goto list_projects
if "%choice%"=="6" goto eas_status
if "%choice%"=="7" goto reconfig
if "%choice%"=="0" exit /b 0
goto menu

:: =============================================
:: 选择项目（通用）
:: =============================================
:choose_project_build
set "ACTION=build"
goto choose_project

:choose_project_export
set "ACTION=export"
goto choose_project

:choose_project_apk
set "ACTION=apk"
goto choose_project

:choose_project_history
set "ACTION=history"
goto choose_project

:choose_project
cls
echo.
echo   %BLUE%╔══════════════════════════════════════╗%RESET%
echo   %BLUE%║           选择项目                   ║%RESET%
echo   %BLUE%╚══════════════════════════════════════╝%RESET%
echo.

cd /d "%TOOL_DIR%"
node src/index.js list
echo.
echo   输入项目 ID（如 suiyue）或输入 0 返回:
set /p "PROJECT_ID=  ^> "

if "%PROJECT_ID%"=="0" goto menu
if "%PROJECT_ID%"=="" goto choose_project

cd /d "%TOOL_DIR%"

if "%ACTION%"=="build" goto do_build
if "%ACTION%"=="export" goto do_export
if "%ACTION%"=="apk" goto do_apk
if "%ACTION%"=="history" goto do_history

:: =============================================
:do_build
cls
node src/index.js build %PROJECT_ID%
echo.
echo   %YELLOW%[按任意键返回菜单]%RESET%
pause >nul
goto menu

:do_export
cls
node src/index.js export %PROJECT_ID%
echo.
echo   %YELLOW%[按任意键返回菜单]%RESET%
pause >nul
goto menu

:do_apk
cls
node src/index.js apk %PROJECT_ID%
echo.
echo.
echo   操作选项:
echo     [C] 复制 APK 到输出目录
echo     [B] 返回
echo.
set /p apk_choice="  请输入 [C/B]: "
if /i "%apk_choice%"=="C" (
    echo   %GREEN%[+] APK 已就绪%RESET%
)
goto menu

:do_history
cls
node src/index.js history %PROJECT_ID%
echo.
echo   %YELLOW%[按任意键返回菜单]%RESET%
pause >nul
goto menu

:: =============================================
:list_projects
cls
cd /d "%TOOL_DIR%"
node src/index.js list
echo.
echo   %YELLOW%[按任意键返回菜单]%RESET%
pause >nul
goto menu

:: =============================================
:eas_status
cls
echo   [*] 查询 EAS 构建状态...
echo.
cd /d "%TOOL_DIR%\..\client"
npx eas build:list --platform android --limit 5
echo.
echo   %YELLOW%[按任意键返回菜单]%RESET%
pause >nul
goto menu

:: =============================================
:reconfig
cls
cd /d "%TOOL_DIR%"
del pack.config.json 2>nul
node src/index.js init
echo.
echo   %YELLOW%配置已重置，请编辑 pack.config.json 后重新运行%RESET%
pause
goto menu

endlocal