$ErrorActionPreference = "Stop"
$root = "C:\Users\joulz\etika-cleanup-20250902-213838\Etika-Blockchain-Project\backend"
$npm  = "C:\Users\joulz\AppData\Roaming\npm\npm.cmd"

Set-Location $root
New-Item -ItemType Directory -Force -Path ".logs" | Out-Null

# Lancer le smoke test et logguer la sortie
& $npm run smoke:dashboard *> ".logs\smoke-dashboard.log" 2>&1
