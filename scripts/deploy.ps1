# Deploys a released version of counting-stock.
#
# Usage:
#   .\scripts\deploy.ps1                  # deploy latest
#   .\scripts\deploy.ps1 -Tag v1.1.0      # deploy specific version
#   .\scripts\deploy.ps1 -Tag v1.0.0      # rollback to an older version (gate protects the DB)
#
# Sequence: pull image -> migration gate -> restart -> health check (version verify).
# Requires: docker compose v2, .env with DB credentials, IMAGE env or -Image override.

param(
    [string]$Tag = "latest",
    [string]$Image = ""
)

$ErrorActionPreference = "Stop"

if (-not $Image) {
    $registry = if ($env:REGISTRY) { $env:REGISTRY } else { "ghcr.io/rizkydaffy/counting-stock" }
    $Image = "${registry}:${Tag}"
}

Write-Host "[deploy] Image: $Image"

$env:IMAGE = $Image

Write-Host "[deploy] Pulling image..."
docker compose pull counting-stock --ignore-buildable
if ($LASTEXITCODE -ne 0) {
    Write-Host "[deploy] Pull failed. Image/tag may not exist in the registry: $Image" -ForegroundColor Red
    exit 1
}

Write-Host "[deploy] Running migration gate..."
docker compose run --rm --no-deps counting-stock npm run migrate:gate
if ($LASTEXITCODE -ne 0) {
    Write-Host "[deploy] Migration gate REFUSED deployment." -ForegroundColor Red
    Write-Host "[deploy] The database is newer than this image. Pick a newer tag or restore the DB from backup." -ForegroundColor Red
    exit 1
}

Write-Host "[deploy] Restarting service..."
docker compose up -d counting-stock
if ($LASTEXITCODE -ne 0) {
    Write-Host "[deploy] Failed to start. Roll back: .\scripts\deploy.ps1 -Tag <previous-tag>" -ForegroundColor Red
    exit 1
}

$appPort = if ($env:APP_PORT) { $env:APP_PORT } else { "3000" }
$healthUrl = "http://localhost:${appPort}/api/health"

Write-Host "[deploy] Waiting for health check at $healthUrl ..."
$deployedVersion = $null
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 2
    try {
        $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 5
        $deployedVersion = $health.version
        break
    } catch {
        # service still booting
    }
}

if ($null -eq $deployedVersion) {
    Write-Host "[deploy] Service did not become healthy in time. Check: docker compose logs counting-stock" -ForegroundColor Red
    Write-Host "[deploy] Roll back: .\scripts\deploy.ps1 -Tag <previous-tag>" -ForegroundColor Red
    exit 1
}

Write-Host "[deploy] Success. Running version: v$deployedVersion" -ForegroundColor Green
if ($Tag -ne "latest" -and $Tag -ne "v$deployedVersion") {
    Write-Host "[deploy] WARNING: requested $Tag but health reports v$deployedVersion" -ForegroundColor Yellow
}
