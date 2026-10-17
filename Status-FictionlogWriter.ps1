[CmdletBinding()]param()
$ErrorActionPreference='Stop'
$Root=$PSScriptRoot
. (Join-Path $Root 'scripts\FictionlogWriterSettings.ps1')
$p=Get-FictionlogWriterPaths -Root $Root
$settings=Get-FictionlogWriterSettings -Root $Root
if (-not $settings) { Write-Host 'Connection settings: not configured'; exit 1 }
Write-Host "Tunnel ID: $($settings.tunnel_id)"
Write-Host "Organization ID: $($settings.organization_id)"
Write-Host "Health port: $($settings.health_port)"
Write-Host "API key: $(if(Test-Path $p.ApiKeyFile){'configured (encrypted)'}else{'not configured'})"
Write-Host "Persistent browser runtime: $($p.PersistentRuntime)"
if (-not (Test-Path $p.LauncherPid)) { Write-Host 'Process: stopped'; exit 1 }
$id=(Get-Content $p.LauncherPid -Raw).Trim()
if (-not (Get-Process -Id $id -ErrorAction SilentlyContinue)) { Write-Host "Process: stopped (stale PID $id)"; exit 1 }
Write-Host "Process: running (PID $id)"
if (-not (Test-Path $p.HealthUrl)) { Write-Host 'Health URL: unavailable'; exit 2 }
$base=(Get-Content $p.HealthUrl -Raw).Trim().TrimEnd('/')
try { $live=Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Uri "$base/healthz"; Write-Host "Liveness: $($live.StatusCode) $($live.Content)" } catch { Write-Host "Liveness: FAIL - $($_.Exception.Message)"; exit 2 }
try { $ready=Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Uri "$base/readyz"; Write-Host "Readiness: $($ready.StatusCode) $($ready.Content)" } catch { Write-Host "Readiness: FAIL - $($_.Exception.Message)"; exit 2 }
Write-Host "UI: $base/ui"
