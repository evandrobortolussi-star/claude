@echo off
cd /d "%~dp0"
echo ============================================
echo   Financeiro Familiar - iniciando o servidor
echo ============================================
echo.
echo Seu IP nesta rede Wi-Fi (para acessar pelo iPhone):
ipconfig | findstr /i "IPv4"
echo.
echo No computador, acesse:      http://localhost:3000
echo No iPhone (mesma Wi-Fi):    http://SEU-IP:3000
echo (troque SEU-IP pelo numero que apareceu acima)
echo.
echo Para parar o servidor, feche esta janela ou aperte Ctrl+C.
echo.
call npm run dev -- -H 0.0.0.0
pause
