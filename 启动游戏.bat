@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title 奥术对决 · 启动

echo [1/3] 清理旧进程...
call :kill_port 5173
call :kill_port 5174
call :kill_port 5175
call :kill_port 5176
call :kill_port 8721
taskkill /F /IM llama-server.exe >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and ($_.CommandLine -like '*GitHub\tcg\node_modules*vite*' -or $_.CommandLine -like '*GitHub\tcg\scripts\qwen*' -or $_.CommandLine -like '*tcg\.local\qwen\bin\llama-server*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1

where node >nul 2>&1
if errorlevel 1 (
  echo 未找到 Node.js，请先安装后再运行本脚本。
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo 正在安装依赖...
  call npm install
  if errorlevel 1 (
    echo npm install 失败。
    pause
    exit /b 1
  )
)

echo [2/3] 启动开发服务器...
start "奥术对决" /D "%~dp0" cmd /k npm run dev

echo [3/3] 等待服务就绪并打开浏览器...
set /a _i=0
:wait
set /a _i+=1
if %_i% GTR 120 (
  echo 启动超时。请查看「奥术对决」窗口里的报错。
  pause
  exit /b 1
)
ping 127.0.0.1 -n 2 >nul
curl.exe -s -o NUL -m 2 http://127.0.0.1:5173/ >nul 2>&1
if errorlevel 1 goto wait

start "" "http://127.0.0.1:5173/"
echo 已打开默认浏览器：http://127.0.0.1:5173/
echo 关掉「奥术对决」窗口即可停服。
ping 127.0.0.1 -n 3 >nul
exit /b 0

:kill_port
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%~1 .*LISTENING"') do (
  if not "%%P"=="0" taskkill /F /PID %%P >nul 2>&1
)
goto :eof
