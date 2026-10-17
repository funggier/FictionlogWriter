[CmdletBinding()]
param([switch]$NonInteractive)
$ErrorActionPreference='Stop'
$Root=$PSScriptRoot
$Client=Join-Path $Root 'tunnel-client.exe'
. (Join-Path $Root 'scripts\FictionlogWriterSettings.ps1')
$p=Get-FictionlogWriterPaths -Root $Root
if (-not (Test-Path -LiteralPath $Client -PathType Leaf)) { throw "Missing tunnel-client.exe in $Root" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js was not found.' }
if (-not (Test-Path -LiteralPath (Join-Path $Root 'fictionlogwriter-mcp.mjs') -PathType Leaf)) { throw 'Missing fictionlogwriter-mcp.mjs.' }

$settings=Get-FictionlogWriterSettings -Root $Root
$apiKey=$null
try { $apiKey=Unprotect-FictionlogWriterApiKey -Root $Root } catch {}
if (-not $settings -or [string]::IsNullOrWhiteSpace($apiKey)) {
    if ($NonInteractive) { throw 'FIRST_RUN_REQUIRED: Run Setup-FictionlogWriter.cmd first.' }
    & (Join-Path $Root 'Setup-FictionlogWriter.ps1') -FillMissing
    if ($LASTEXITCODE -ne 0) { throw "Setup failed (exit $LASTEXITCODE)." }
    $settings=Get-FictionlogWriterSettings -Root $Root
    $apiKey=Unprotect-FictionlogWriterApiKey -Root $Root
}
if (-not $settings -or [string]::IsNullOrWhiteSpace($apiKey)) { throw 'Connection setup is incomplete.' }

if (Test-Path -LiteralPath $p.LauncherPid) {
    $existingPid=(Get-Content -LiteralPath $p.LauncherPid -Raw).Trim()
    if (Get-Process -Id $existingPid -ErrorAction SilentlyContinue) { Write-Host "FictionlogWriter already running (PID $existingPid)."; exit 0 }
    Remove-Item -LiteralPath $p.LauncherPid -Force -ErrorAction SilentlyContinue
}
if (-not (Test-FictionlogWriterPortAvailable -Port ([int]$settings.health_port))) { throw "Configured health port $($settings.health_port) is in use." }
New-Item -ItemType Directory -Force -Path $p.Runtime,$p.Logs,$p.PersistentRuntime | Out-Null
$profile=Write-FictionlogWriterProfile -Root $Root
$previousKey=$env:CONTROL_PLANE_API_KEY
$previousOrg=$env:CONTROL_PLANE_ORGANIZATION_ID
try {
    $env:CONTROL_PLANE_API_KEY=$apiKey
    $env:CONTROL_PLANE_ORGANIZATION_ID=[string]$settings.organization_id
    Push-Location -LiteralPath $Root
    try {
        & $Client doctor --profile-file $profile --control-plane.organization-id $settings.organization_id --pid.file $p.TunnelPid --explain 2>&1 | Tee-Object -FilePath (Join-Path $p.Logs 'doctor-latest.log')
        if ($LASTEXITCODE -ne 0) { throw 'Configuration check failed.' }
        $stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
        $args=@('run','--profile-file',$profile,'--control-plane.organization-id',$settings.organization_id,'--pid.file',$p.TunnelPid)
        $proc=Start-Process -FilePath $Client -WorkingDirectory $Root -ArgumentList $args -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $p.Logs "tunnel-$stamp.out.log") -RedirectStandardError (Join-Path $p.Logs "tunnel-$stamp.err.log")
        Set-Content -LiteralPath $p.LauncherPid -Value $proc.Id -NoNewline
    } finally { Pop-Location }
    Start-Sleep -Seconds 2
    if (-not (Get-Process -Id $proc.Id -ErrorAction SilentlyContinue)) { throw 'FictionlogWriter tunnel exited during startup.' }
    Write-Host "FictionlogWriter started (PID $($proc.Id))."
    Write-Host "Tunnel ID: $($settings.tunnel_id)"
    Write-Host "Health port: $($settings.health_port)"
}
finally {
    if ($null -eq $previousKey) { Remove-Item Env:CONTROL_PLANE_API_KEY -ErrorAction SilentlyContinue } else { $env:CONTROL_PLANE_API_KEY=$previousKey }
    if ($null -eq $previousOrg) { Remove-Item Env:CONTROL_PLANE_ORGANIZATION_ID -ErrorAction SilentlyContinue } else { $env:CONTROL_PLANE_ORGANIZATION_ID=$previousOrg }
    Remove-Variable apiKey -ErrorAction SilentlyContinue
}
