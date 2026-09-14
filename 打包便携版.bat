@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title 奥术对决 · 打包便携版

where node >nul 2>&1
if errorlevel 1 (
  echo 未找到 Node.js，请先安装后再运行本脚本。
  pause
  exit /b 1
)

if not exist "node_modules\electron-builder\cli.js" (
  echo 正在安装依赖...
  call npm install
  if errorlevel 1 (
    echo npm install 失败。
    pause
    exit /b 1
  )
)

echo 正在重打可双击运行的便携版，并覆盖：
echo   %~dp0release\奥术对决.exe
echo.

call npm run dist
if errorlevel 1 (
  echo.
  echo 打包失败。
  pause
  exit /b 1
)

echo.
echo 已更新：%~dp0release\奥术对决.exe
echo 双击该文件即可游玩，无需安装。
pause
exit /b 0
