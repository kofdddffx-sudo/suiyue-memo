@echo off
chcp 65001 >nul
title 岁月备忘录 - 一键APK打包工具
color 0A

:: ============================================================
:: 岁月备忘录 - 一键APK打包工具
:: 适用于 Windows 10/11
:: 需要：Node.js 20+、Expo 账号
:: ============================================================

set TARGET_DIR=E:\其他\岁月APP
set PROJECT_ROOT=%~dp0
set CLIENT_DIR=%PROJECT_ROOT%client

:MENU
cls
echo ╔══════════════════════════════════════════════════════╗
echo ║                                                      ║
echo ║           岁月备忘录 - 一键APK打包                     ║
echo ║                                                      ║
echo ╠══════════════════════════════════════════════════════╣
echo ║                                                      ║
echo ║    1. 🚀  一键打包APK（完整流程）                      ║
echo ║    2. 🔧  检查开发环境                                ║
echo ║    3. 🔑  Expo 登录                                  ║
echo ║    4. 📂  打开APK输出目录                             ║
echo ║    5.   ❌ 退出                                       ║
echo ║                                                      ║
echo ╚══════════════════════════════════════════════════════╝
echo.
set /p choice="请输入选项编号 (1-5) 后按回车: "

if "%choice%"=="1" goto BUILD
if "%choice%"=="2" goto CHECK_ENV
if "%choice%"=="3" goto EXPO_LOGIN
if "%choice%"=="4" goto OPEN_DIR
if "%choice%"=="5" goto EXIT
goto MENU

:: ============================================================
:: 一键打包完整流程
:: ============================================================
:BUILD
cls
echo ╔══════════════════════════════════════════════════════╗
echo ║                开始打包APK...                         ║
echo ╚══════════════════════════════════════════════════════╝
echo.

:: 确保目标目录存在
if not exist "%TARGET_DIR%" (
    mkdir "%TARGET_DIR%"
    if errorlevel 1 (
        echo [!] 无法创建目录 %TARGET_DIR%
        echo     请检查 E 盘是否存在，或修改脚本中的 TARGET_DIR 路径
        pause
        goto MENU
    )
)

:: 第1步：检查 Node.js
echo [1/5] 检查 Node.js 环境...
where node >nul 2>&1
if errorlevel 1 (
    echo [!] 未检测到 Node.js！
    echo     请先访问 https://nodejs.org/ 下载安装
    pause
    goto MENU
)
for /f "tokens=1-3" %%a in ('node --version') do set NODE_VER=%%a
echo [OK] Node.js 版本: %NODE_VER%
echo.

:: 第2步：进入项目目录
echo [2/5] 进入项目目录...
cd /d "%CLIENT_DIR%"
if errorlevel 1 (
    echo [!] 无法进入目录: %CLIENT_DIR%
    echo     请检查项目是否放在正确位置
    pause
    goto MENU
)
echo [OK] 当前目录: %CD%
echo.

:: 第3步：安装项目依赖
echo [3/5] 检查并安装项目依赖...
echo      这需要 1-3 分钟，请耐心等待...
echo.
call npx expo install
if errorlevel 1 (
    echo [!] 依赖安装失败，请检查网络后重试
    pause
    goto MENU
)
echo [OK] 依赖安装完成
echo.

:: 第4步：检查 Expo 登录状态
echo [4/5] 检查 Expo 登录状态...
npx eas whoami > "%TEMP%\eas_whoami.txt" 2>&1
set /p EAS_USER=<"%TEMP%\eas_whoami.txt"
if "%EAS_USER%"=="" (
    echo [!] 您还未登录 Expo 账号！
    echo     正在跳转到登录页面...
    echo.
    call npx eas login
    if errorlevel 1 (
        echo [!] 登录失败，请重试
        pause
        goto MENU
    )
) else (
    echo [OK] 已登录: %EAS_USER%
)
echo.

:: 第5步：开始构建 APK
echo [5/5] 开始构建 APK（EAS云端构建）...
echo      构建需要 5-15 分钟，请耐心等待...
echo      期间请勿关闭此窗口！
echo.
echo     开始时间: %date% %time%
echo.
call npx eas build --platform android --profile preview --non-interactive
if errorlevel 1 (
    echo.
    echo [!] 构建失败！请查看上方错误信息
    pause
    goto MENU
)

echo.
echo ═══════════════════════════════════════════════════════
echo.
echo [OK] 构建完成！
echo.

:: 提示用户手动复制 APK
echo ╔══════════════════════════════════════════════════════╗
echo ║            打包完成！下一步操作                       ║
echo ╠══════════════════════════════════════════════════════╣
echo ║                                                      ║
echo ║  1. 在上方的输出中找到 Artifact URL 链接               ║
echo ║  2. 在浏览器中打开该链接，下载 .apk 文件               ║
echo ║  3. 将下载的 .apk 文件复制到：                        ║
echo ║     %TARGET_DIR%                   ║
echo ║                                                      ║
echo ║  4. 双击 testing\run-tests.bat 开始测试！              ║
echo ║                                                      ║
echo ╚══════════════════════════════════════════════════════╝
echo.
pause
goto MENU

:: ============================================================
:: 检查开发环境
:: ============================================================
:CHECK_ENV
cls
echo ╔══════════════════════════════════════════════════════╗
echo ║                检查开发环境...                         ║
echo ╚══════════════════════════════════════════════════════╝
echo.

:: 检查 Node.js
echo [1] Node.js:
where node >nul 2>&1
if errorlevel 1 (
    echo     ✗ 未安装
    echo     请访问 https://nodejs.org/ 下载安装
) else (
    for /f "tokens=1-3" %%a in ('node --version') do set NODE_VER=%%a
    echo     ✓ %NODE_VER%
)
echo.

:: 检查 npm
echo [2] npm:
where npm >nul 2>&1
if errorlevel 1 (
    echo     ✗ 未安装
) else (
    for /f "tokens=1-3" %%a in ('npm --version') do set NPM_VER=%%a
    echo     ✓ v%NPM_VER%
)
echo.

:: 检查项目目录
echo [3] 项目目录:
if exist "%CLIENT_DIR%" (
    echo     ✓ %CLIENT_DIR%
) else (
    echo     ✗ 未找到
    echo     请确保项目已下载到正确位置
)
echo.

:: 检查依赖
echo [4] 项目依赖:
if exist "%CLIENT_DIR%\node_modules" (
    echo     ✓ 依赖已安装
) else (
    echo     ✗ 未安装（运行本工具选项1会自动安装）
)
echo.

:: 检查 Expo 登录
echo [5] Expo 登录状态:
npx eas whoami > "%TEMP%\eas_whoami.txt" 2>&1
set /p EAS_USER=<"%TEMP%\eas_whoami.txt"
if "%EAS_USER%"=="" (
    echo     ✗ 未登录（使用选项3登录）
) else (
    echo     ✓ 已登录: %EAS_USER%
)
echo.

:: 检查 EAS CLI
echo [6] EAS CLI:
npx eas --version > "%TEMP%\eas_version.txt" 2>&1
set /p EAS_VER=<"%TEMP%\eas_version.txt"
if "%EAS_VER%"=="" (
    echo     ✗ 未安装
) else (
    echo     ✓ %EAS_VER%
)
echo.

:: 检查目标目录
echo [7] APK输出目录:
if exist "%TARGET_DIR%" (
    echo     ✓ %TARGET_DIR%
) else (
    echo     ✗ %TARGET_DIR%（将自动创建）
)
echo.

echo ═══════════════════════════════════════════════════════
echo.
echo 检查完成！按任意键返回主菜单...
pause >nul
goto MENU

:: ============================================================
:: Expo 登录
:: ============================================================
:EXPO_LOGIN
cls
echo ╔══════════════════════════════════════════════════════╗
echo ║                 Expo 登录                           ║
echo ╚══════════════════════════════════════════════════════╝
echo.
echo 请先在浏览器注册：https://expo.dev/signup
echo 注册完成后，在此登录：
echo.
call npx eas login
echo.
if errorlevel 1 (
    echo [!] 登录失败，请重试
) else (
    echo [OK] 登录成功！
)
pause
goto MENU

:: ============================================================
:: 打开 APK 输出目录
:: ============================================================
:OPEN_DIR
if exist "%TARGET_DIR%" (
    start "" "%TARGET_DIR%"
) else (
    echo [!] 目录不存在，将自动创建...
    mkdir "%TARGET_DIR%"
    start "" "%TARGET_DIR%"
)
goto MENU

:: ============================================================
:: 退出
:: ============================================================
:EXIT
cls
echo.
echo 感谢使用岁月备忘录打包工具！
echo.
exit /b 0