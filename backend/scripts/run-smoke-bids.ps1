Param(
  [Parameter(Position=0)]
  [string]$AuctionId = $Env:AUCTION_ID
)

if (-not $AuctionId) {
  Write-Host "Usage: .\run-smoke-bids.ps1 <AUCTION_UUID>  (ou définir AUCTION_ID dans l'env)" -ForegroundColor Yellow
  exit 2
}

# Détection Node.js
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Error "Node.js introuvable dans le PATH."
  exit 1
}

# Résolution des chemins
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Resolve-Path (Join-Path $scriptDir "..")
$js = Join-Path $repoRoot "scripts\smoke-check-bids.js"

Write-Host "[run-smoke-bids] AUCTION_ID=$AuctionId"
& $node.Path $js $AuctionId
exit $LASTEXITCODE
