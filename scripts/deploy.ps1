# Deploys a released version of counting-stock.
#
# Usage:
#   .\scripts\deploy.ps1                  # deploy latest
#   .\scripts\deploy.ps1 -Tag v1.1.0      # deploy specific version
#   .\scripts\deploy.ps1 -Tag v1.0.0      # rollback to an older version (gate protects the DB)
#
# IMPORTANT: run this ON THE DOCKER HOST (the server), from the project root.
# The compose file uses external networks (counting-networks, nginx-public)
# and an external MySQL. These only exist on the host that runs the stack.
#
# Sequence: pre-flight checks -> pull image -> migration gate -> restart -> health check.
# NOTE: this file must stay PURE ASCII. PowerShell 5.1 misreads non-ASCII bytes.

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

# ---------- Pre-flight ----------
if (-not (Test-Path ".env")) {
    Write-Host "[deploy] WARNING: no .env file in current directory." -ForegroundColor Yellow
    Write-Host "[deploy]          Compose will default env vars to blank (INTERNAL_API_KEY etc.)." -ForegroundColor Yellow
} else {
    foreach ($var in @("INTERNAL_API_KEY", "VITE_INTERNAL_API_KEY")) {
        $found = Select-String -Path ".env" -Pattern ("^\s*" + $var + "\s*=") -ErrorAction SilentlyContinue
        if (-not $found) {
            Write-Host "[deploy] WARNING: $var not set in .env. Compose warning is expected." -ForegroundColor Yellow
        }
    }
}

foreach ($net in @("counting-networks", "nginx-public")) {
    docker network inspect $net *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[deploy] FATAL: Docker network '$net' does not exist on this machine." -ForegroundColor Red
        Write-Host "[deploy] This script must run on the Docker host where the stack lives" -ForegroundColor Red
        Write-Host "[deploy] (the server that runs counting-stock + MySQL + nginx)." -ForegroundColor Red
        Write-Host "[deploy] If you ARE on the server: check 'docker network ls'." -ForegroundColor Red
        exit 1
    }
}

# ---------- Pull ----------
# 'docker compose pull' SKIPS services that have a build: section, so pull by full name.
Write-Host "[deploy] Pulling image..."
docker pull $Image
if ($LASTEXITCODE -ne 0) {
    Write-Host "[deploy] Pull failed. Tag may not exist in the registry: $Image" -ForegroundColor Red
    Write-Host "[deploy] Check: ghcr.io package page, and that the Release workflow succeeded for this tag." -ForegroundColor Red
    exit 1
}

$gsheetImage = "${registry}-gsheet:${Tag}"
Write-Host "[deploy] Pulling gsheet image..."
docker pull $gsheetImage
if ($LASTEXITCODE -ne 0) {
    Write-Host "[deploy] WARNING: gsheet image pull failed: $gsheetImage" -ForegroundColor Yellow
    Write-Host "[deploy]          The /backup (BCP) service will keep its current image." -ForegroundColor Yellow
} else {
    $env:GSHEET_IMAGE = $gsheetImage
}

$env:IMAGE = $Image

# ---------- Migration gate ----------
Write-Host "[deploy] Running migration gate..."
# Native stderr (compose warnings) must not become terminating PS errors while captured.
$ErrorActionPreference = "Continue"
$gateOutput = (docker compose run --rm --no-deps counting-stock npm run migrate:gate) 2>&1
$gateExit = $LASTEXITCODE
$ErrorActionPreference = "Stop"
$gateOutput | ForEach-Object { Write-Host "  $_" }
if ($gateExit -ne 0) {
    if ("$gateOutput" -match "REFUSING") {
        Write-Host "[deploy] Migration gate REFUSED: database schema is newer than this image." -ForegroundColor Red
        Write-Host "[deploy] Deploy a version >= the DB schema version, or restore the DB from backup." -ForegroundColor Red
    } else {
        Write-Host "[deploy] Migration gate FAILED TO RUN (not a version problem)." -ForegroundColor Red
        Write-Host "[deploy] Read the output above. Typical causes:" -ForegroundColor Red
        Write-Host "[deploy]   - MySQL unreachable: check DB_HOST/DB_PASSWORD in .env, 'docker ps' for the db container" -ForegroundColor Red
        Write-Host "[deploy]   - Missing external network: run this script on the Docker host" -ForegroundColor Red
        Write-Host "[deploy]   - Wrong working directory: run from project root (next to docker-compose.yml)" -ForegroundColor Red
    }
    exit 1
}

# ---------- Restart ----------
Write-Host "[deploy] Restarting service..."
# --no-build: never build locally, always use the pulled registry image.
docker compose up -d --no-build counting-stock gsheet
if ($LASTEXITCODE -ne 0) {
    Write-Host "[deploy] Failed to start. Roll back: .\scripts\deploy.ps1 -Tag <previous-tag>" -ForegroundColor Red
    exit 1
}

# ---------- Health check ----------
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
