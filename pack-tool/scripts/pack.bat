@echo off
chcp 65001 >nul
title 通用 Expo 打包工具 v1.0

:: =============================================
:: 通用 Expo 打包工具 - Windows 一键启动脚本
:: 用法: 双击运行即可
:: 可放在 pack-tool 文件夹下任意位置
:: =============================================

setlocal enabledelayedexpansion

:: 获取脚本所在目录
set "SCRIPT_DIR=%~dp0"
set "TOOL_DIR=%SCRIPT_DIR%"

:: 如果用户把 bat 文件单独复制出来了，自动找 pack-tool 目录
if not exist "%TOOL_DIR%src\index.js" (
    if exist "%TOOL_DIR%..\src\index.js" set "TOOL_DIR=%TOOL_DIR%.."
    if exist "%~dp0..\pack-tool\src\index.js" set "TOOL_DIR=%~dp0..\pack-tool"
)

:: =============================================
:: 第一步：检查 Node.js
:: =============================================
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    cls
    echo ========================================
    echo     [!] 未找到 Node.js
    echo ========================================
    echo.
    echo     请先安装 Node.js 20+
    echo     下载地址: https://nodejs.org/
    echo.
    echo     安装后重新运行本工具即可
    echo.
    echo ========================================
    pause
    exit /b 1
)

:: =============================================
:: 第二步：自动安装依赖
:: =============================================
if not exist "%TOOL_DIR%node_modules" (
    cls
    echo ========================================
    echo     [*] 首次使用，正在安装依赖...
    echo ========================================
    echo.
    cd /d "%TOOL_DIR%"
    call npm install
    if !ERRORLEVEL! neq 0 (
        echo.
        echo [!] 依赖安装失败，请检查网络后重试
        pause
        exit /b 1
    )
    echo.
    echo [+] 依赖安装完成!
    timeout /t 2 /nobreak >nul
)

:: =============================================
:: 第三步：初始化配置（首次使用）
:: =============================================
if not exist "%TOOL_DIR%pack.config.json" (
    cls
    echo ========================================
    echo     [*] 首次使用，正在初始化配置...
    echo ========================================
    echo.
    cd /d "%TOOL_DIR%"
    node src/index.js init
    echo.
    echo ========================================
    echo     请编辑 pack.config.json 文件
    echo     添加你的项目配置后重新运行
    echo ========================================
    echo.
    pause
    exit /b 0
)

:: =============================================
:: 主菜单
:: =============================================
:menu
cls
echo.
echo ========================================
echo      通用 Expo 打包工具 v1.0
echo      通用打包，多项目支持
echo ========================================
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
echo   [!] 无效选项，请重新输入
timeout /t 2 /nobreak >nul
goto menu

:: =============================================
:: 选择项目
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
echo ========================================
echo           选择项目
echo ========================================
echo.
cd /d "%TOOL_DIR%"
node src/index.js list
echo.
echo 输入项目 ID (如 suiyue)，或输入 0 返回:
set /p "PROJECT_ID=  > "

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
echo ========================================
echo   [*] 正在打包: %PROJECT_ID%
echo ========================================
echo.
cd /d "%TOOL_DIR%"
node src/index.js build "%PROJECT_ID%"
echo.
echo ========================================
echo   打包完成！
echo ========================================
pause
goto menu

:do_export
cls
echo ========================================
echo   [*] 正在导出: %PROJECT_ID%
echo ========================================
echo.
cd /d "%TOOL_DIR%"
node src/index.js export "%PROJECT_ID%"
echo.
echo ========================================
echo   导出完成！
echo ========================================
pause
goto menu

:do_apk
cls
cd /d "%TOOL_DIR%"
node src/index.js apk "%PROJECT_ID%"
echo.
echo ========================================
echo   操作选项:
echo     [C] 复制 APK 到输出目录
echo     [B] 返回
echo ========================================
echo.
set /p apk_choice="  请输入 [C/B]: "
if /i "%apk_choice%"=="C" (
    node src/index.js apk-copy "%PROJECT_ID%"
    echo.
    pause
)
goto menu

:do_history
cls
cd /d "%TOOL_DIR%"
node src/index.js history "%PROJECT_ID%"
echo.
pause
goto menu

:: =============================================
:list_projects
cls
cd /d "%TOOL_DIR%"
node src/index.js list
echo.
pause
goto menu

:: =============================================
:eas_status
cls
echo [*] 查询 EAS 构建状态...
echo.
cd /d "%TOOL_DIR%"
node src/index.js status "%PROJECT_ID%"
echo.
pause
goto menu

:: =============================================
:reconfig
cls
cd /d "%TOOL_DIR%"
del pack.config.json 2>nul
echo ========================================
echo   正在重新初始化配置...
echo ========================================
echo.
node src/index.js init
echo.
echo ========================================
echo   请编辑 pack.config.json 文件
echo   添加你的项目配置后重新运行
echo ========================================
echo.
pause
exit /b 0