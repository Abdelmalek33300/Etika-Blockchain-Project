# Étika — Certificat dev HTTPS (localhost)

$proj = "C:\Users\joulz\etika-cleanup-20250902-213838\Etika-Blockchain-Project"
$certDir = Join-Path $proj "backend\certs"
New-Item -ItemType Directory -Force $certDir | Out-Null

$pfxPath    = Join-Path $certDir "localhost.pfx"
$pfxPassStr = "etika123"
$pfxPass    = ConvertTo-SecureString -String $pfxPassStr -Force -AsPlainText

$cert = New-SelfSignedCertificate -DnsName "localhost","127.0.0.1" `
  -CertStoreLocation "cert:\CurrentUser\My" `
  -FriendlyName "Etika Dev Cert" `
  -KeyAlgorithm RSA -KeyLength 2048 `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -NotAfter (Get-Date).AddYears(1)

Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $pfxPass -Force | Out-Null

$envPath = Join-Path $proj "backend\.env"
$lines = @()
if (Test-Path $envPath) {
  $lines = Get-Content $envPath | Where-Object {
    ($_ -notmatch '^\s*TLS_PFX_PATH=') -and
    ($_ -notmatch '^\s*TLS_PFX_PASSPHRASE=')
  }
}
$lines += "TLS_PFX_PATH=backend/certs/localhost.pfx"
$lines += "TLS_PFX_PASSPHRASE=$pfxPassStr"
$lines | Set-Content -NoNewline:$false -Path $envPath -Encoding UTF8

write-Host "Ok Certificat généré et .env mis à jour."
write-Host ( "PFX : " + $pfxPath)


