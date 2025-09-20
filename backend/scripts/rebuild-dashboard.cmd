@echo off
REM -----------------------------------------------------------------------------
REM Étika — rebuild-dashboard.cmd (SMOKE + PROBE + rotation atomique)
REM - Exécute le smoke test et le probe
REM - Log: backend\.cache\rebuild.log
REM - Rotation atomique: écrit d’abord dans un .tmp puis remplace le log
REM -----------------------------------------------------------------------------

cd /d "%~dp0..\.."

if not exist "backend\.cache" mkdir "backend\.cache"

set "LOG=backend\.cache\rebuild.log"
set "LOGTMP=backend\.cache\rebuild.tmp"

echo [START %date% %time%] >> "%LOG%"
echo Running: npm --prefix backend run smoke:dashboard >> "%LOG%"

REM IMPORTANT: utiliser CALL pour revenir après npm.cmd
call npm --prefix backend run smoke:dashboard >> "%LOG%" 2>&1
echo ExitCode(SMOKE): %ERRORLEVEL% >> "%LOG%"

echo Running: node backend\scripts\probe-dashboard.mjs >> "%LOG%"
node backend\scripts\probe-dashboard.mjs >> "%LOG%" 2>&1
echo ExitCode(PROBE): %ERRORLEVEL% >> "%LOG%"

echo [END %date% %time%] >> "%LOG%"
echo. >> "%LOG%"

REM --- Rotation atomique (utilise pwsh; écrit dans LOGTMP puis remplace LOG)
pwsh -NoProfile -Command "Get-Content -LiteralPath '%LOG%' -Tail 500 | Set-Content -LiteralPath '%LOGTMP%'" 2>nul
if exist "%LOGTMP%" move /Y "%LOGTMP%" "%LOG%" >nul

echo Log ecrit dans "%LOG%"
