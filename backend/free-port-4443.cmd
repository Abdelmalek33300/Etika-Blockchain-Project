@echo off
REM =========================================================
REM Script : free-port-4443.cmd
REM Objectif : tuer le process qui occupe le port 4443
REM Utilisation : double-cliquer sur ce fichier
REM =========================================================

echo [INFO] Recherche du processus qui écoute sur le port 4443...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4443 ^| findstr LISTENING') do (
    echo [INFO] PID trouvé : %%a
    taskkill /F /PID %%a
    echo [INFO] Processus %%a arrêté avec succès.
    goto :end
)

echo [OK] Aucun processus trouvé sur le port 4443.

:end
pause
