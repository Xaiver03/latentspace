@echo off
REM 潜空间 (Latent Space) 启动脚本 - Windows版本
REM 用于快速启动开发环境

echo.
echo ==============================
echo   潜空间开发环境启动器
echo ==============================
echo.

REM 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

REM 检查依赖
if not exist "node_modules" (
    echo [警告] 未找到 node_modules，正在安装依赖...
    call npm install
)

REM 检查 .env 文件
if not exist ".env" (
    echo [警告] 未找到 .env 文件，将使用默认配置
)

REM 运行 Node.js 启动脚本
node start.js

pause