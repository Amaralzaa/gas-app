@echo off
title Gas Express - Servidor Local
cd /d "%~dp0"
echo ===================================================
echo           INICIANDO GAS EXPRESS LOCAL
echo ===================================================
echo.
echo [1/2] Abrindo navegador em 3 segundos...
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"
echo [2/2] Iniciando servidor...
echo.
echo Acesso no Computador: http://localhost:3000
echo Acesso no Celular:    http://192.168.15.8:3000
echo.
echo Pressione Ctrl + C para encerrar.
echo ===================================================
echo.
call npm run dev
pause
