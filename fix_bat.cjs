const fs = require('fs');
const path = require('path');

const projectDir = path.resolve('c:/Users/rafae/OneDrive/Área de Trabalho/Automações/gas-app');
const desktopDir = path.resolve('C:/Users/rafae/OneDrive/Área de Trabalho');

const contentLocal = [
  '@echo off',
  'title Gas Express - Servidor Local',
  'cd /d "%~dp0"',
  'echo ===================================================',
  'echo           INICIANDO GAS EXPRESS LOCAL',
  'echo ===================================================',
  'echo.',
  'echo [1/2] Abrindo navegador em 3 segundos...',
  'start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"',
  'echo [2/2] Iniciando servidor...',
  'echo.',
  'echo Acesso no Computador: http://localhost:3000',
  'echo Acesso no Celular:    http://192.168.15.8:3000',
  'echo.',
  'echo Pressione Ctrl + C para encerrar.',
  'echo ===================================================',
  'echo.',
  'call npm run dev',
  'pause'
].join('\r\n') + '\r\n';

fs.writeFileSync(path.join(projectDir, 'iniciar_local.bat'), contentLocal, 'latin1');

const contentDesktop = [
  '@echo off',
  'title Gas Express',
  `cd /d "${projectDir}"`,
  'call iniciar_local.bat',
  'pause'
].join('\r\n') + '\r\n';

fs.writeFileSync(path.join(desktopDir, 'INICIAR_GAS_APP.bat'), contentDesktop, 'latin1');

console.log('Both bat files created successfully with CRLF Windows encoding!');
