@echo off
chcp 65001 >nul
title 岁月备忘录 - 自动化测试工具

echo ============================================
echo   岁月备忘录 自动化测试工具
echo ============================================
echo.

:: 检查 Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装: https://nodejs.org/
    pause
    exit /b 1
)

:: 进入测试目录
cd /d "%~dp0"

:: 安装依赖
if not exist "node_modules" (
    echo [正在] 安装测试依赖...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
    echo [完成] 依赖安装成功
    echo.
)

:: 执行测试
echo [正在] 运行全量自动化测试...
echo.

:menu
cls
echo ╔══════════════════════════════════════════════════════╗
echo ║              岁月备忘录 - 自动化测试                   ║
echo ╠══════════════════════════════════════════════════════╣
echo ║                                                      ║
echo ║    1. 🚀 一键打包APK（完整流程）                       ║
echo ║    2. 🔬 一键全量测试 (API + APK + 模拟器)             ║
echo ║    3. 🌐 仅测试 API 接口                              ║
echo ║    4. 📦 仅验证 APK 文件                              ║
echo ║    5. 📱 仅模拟器测试 (需 LDPlayer4)                  ║
echo ║    6. 📂 查看最新测试报告                              ║
echo ║    7. ❌ 退出                                         ║
echo ║                                                      ║
echo ╚══════════════════════════════════════════════════════╝
echo.
set /p choice="请输入选项编号 (1-7) 后按回车: "

if "%choice%"=="1" (
    echo.
    echo [正在] 打开一键打包工具...
    start "" "%~dp0..\build-apk.bat"
    goto end
)
if "%choice%"=="2" (
    node run-all-tests.js
    if %ERRORLEVEL% equ 0 (
        echo.
        echo 全部测试通过！
    ) else (
        echo.
        echo 测试有失败项，请查看报告
    )
    goto end
)
if "%choice%"=="3" (
    node run-all-tests.js api
    goto end
)
if "%choice%"=="4" (
    node run-all-tests.js apk
    goto end
)
if "%choice%"=="5" (
    node run-all-tests.js emulator
    goto end
)
if "%choice%"=="6" (
    if exist "E:\其他\岁月APP\test-reports\" (
        start "" "E:\其他\岁月APP\test-reports"
        echo 已打开报告文件夹
    ) else (
        echo 暂无测试报告
    )
    goto end
)
if "%choice%"=="7" exit /b 0

echo 无效选项，请重新输入
timeout /t 2 >nul
goto menu

:end
echo.
echo ============================================
echo  报告位置: E:\其他\岁月APP\test-reports
echo ============================================
echo.
pause