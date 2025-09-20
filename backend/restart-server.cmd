@echo off
REM =========================================================
REM Script : restart-server.cmd
REM Objectif : libérer le port 4443 et relancer le serveur
REM =========================================================

echo [INFO] Vérification du port 4443...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4443 ^| findstr LISTENING') do (
    echo [INFO] PID trouvé sur 4443 : %%a
    taskkill /F /PID %%a
    echo [INFO] Processus %%a arrêté avec succès.
)

echo [INFO] Lancement du serveur Node.js...
cd /d C:\Users\joulz\etika-cleanup-20250902-213838\Etika-Blockchain-Project\backend
set PORT=4443
node server.js

pause
