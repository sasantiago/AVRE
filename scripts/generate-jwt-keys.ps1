# Genera un par de claves RSA para firmar JWT (RS256) en desarrollo.
# Requiere OpenSSL disponible en el PATH (Git Bash / Git for Windows ya lo trae).
#
# Uso: powershell -File scripts/generate-jwt-keys.ps1

$ErrorActionPreference = "Stop"

$keysDir = Join-Path $PSScriptRoot "..\infra\keys"
New-Item -ItemType Directory -Force -Path $keysDir | Out-Null

$privateKeyPath = Join-Path $keysDir "jwt-private.pem"
$publicKeyPath = Join-Path $keysDir "jwt-public.pem"

if ((Test-Path $privateKeyPath) -or (Test-Path $publicKeyPath)) {
    Write-Warning "Ya existen claves en infra/keys/. Borralas manualmente antes de regenerar (evita romper sesiones activas por accidente)."
    exit 1
}

$opensslCmd = Get-Command openssl -ErrorAction SilentlyContinue
if (-not $opensslCmd) {
    Write-Error "No se encontro 'openssl' en el PATH. Instala Git for Windows (incluye OpenSSL) o OpenSSL para Windows."
    exit 1
}

& openssl genrsa -out $privateKeyPath 2048
& openssl rsa -in $privateKeyPath -pubout -out $publicKeyPath

Write-Host "Claves de desarrollo generadas en infra/keys/ (gitignored)."
Write-Host "  Privada: $privateKeyPath"
Write-Host "  Publica: $publicKeyPath"
Write-Warning "Estas claves son SOLO para desarrollo local. Nunca las commitees ni las reutilices en produccion."
