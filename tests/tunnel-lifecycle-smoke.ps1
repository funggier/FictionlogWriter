$ErrorActionPreference='Stop'
$SourceRoot=Split-Path -Parent $PSScriptRoot
$TempRoot=Join-Path $env:TEMP ('fictionlogwriter-lifecycle-'+[Guid]::NewGuid().ToString('N'))

function Assert-True { param([bool]$Condition,[string]$Message) if(-not $Condition){throw $Message} }
function Get-FreePort {
    $listener=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,0)
    $listener.Start()
    try { return ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port }
    finally { $listener.Stop() }
}

try {
    New-Item -ItemType Directory -Force -Path (Join-Path $TempRoot 'scripts'),(Join-Path $TempRoot 'fictionlogwriter-runtime') | Out-Null
    Set-Content -LiteralPath (Join-Path $TempRoot 'fictionlogwriter-runtime\profile-marker.txt') -Value 'preserve-me'
    foreach($name in @('Setup-FictionlogWriter.ps1','Clear-FictionlogWriterSettings.ps1')) {
        Copy-Item -LiteralPath (Join-Path $SourceRoot $name) -Destination (Join-Path $TempRoot $name)
    }
    Copy-Item -LiteralPath (Join-Path $SourceRoot 'scripts\FictionlogWriterSettings.ps1') -Destination (Join-Path $TempRoot 'scripts\FictionlogWriterSettings.ps1')
    . (Join-Path $TempRoot 'scripts\FictionlogWriterSettings.ps1')

    $api='synthetic-fictionlog-api-key'
    $port=Get-FreePort
    & (Join-Path $TempRoot 'Setup-FictionlogWriter.ps1') -TunnelId 'tunnel-fictionlog-test' -ApiKey $api -OrganizationId 'org-fictionlog-test' -HealthPort $port -Force | Out-Null

    $settings=Get-FictionlogWriterSettings -Root $TempRoot
    Assert-True ($settings.tunnel_id -eq 'tunnel-fictionlog-test') 'Tunnel ID mismatch'
    Assert-True ($settings.organization_id -eq 'org-fictionlog-test') 'Organization mismatch'
    Assert-True ([int]$settings.health_port -eq $port) 'Port mismatch'
    Assert-True ((Unprotect-FictionlogWriterApiKey -Root $TempRoot) -eq $api) 'API key round-trip mismatch'
    $yaml=Get-Content -LiteralPath (Join-Path $TempRoot 'mcp-conf.yaml') -Raw
    Assert-True ($yaml -match 'env:CONTROL_PLANE_API_KEY') 'Profile must use API key environment indirection'
    Assert-True ($yaml -match 'fictionlogwriter-mcp\.mjs') 'Profile missing FictionlogWriter entrypoint'
    Assert-True ($yaml -notmatch 'org-fictionlog-test') 'Organization must not be embedded in profile'
    Write-Host 'setup separated settings/API key/profile: PASS'

    & (Join-Path $TempRoot 'Clear-FictionlogWriterSettings.ps1') -Mode connection -Force | Out-Null
    Assert-True ($null -eq (Get-FictionlogWriterSettings -Root $TempRoot)) 'connection clear left settings'
    Assert-True (-not (Test-Path (Join-Path $TempRoot 'mcp-conf.yaml'))) 'connection clear left profile'
    Assert-True ((Unprotect-FictionlogWriterApiKey -Root $TempRoot) -eq $api) 'connection clear removed API key'
    Assert-True (Test-Path (Join-Path $TempRoot 'fictionlogwriter-runtime\profile-marker.txt')) 'connection clear touched persistent browser runtime'
    Write-Host 'connection clear preserves API key/browser runtime: PASS'

    $port2=Get-FreePort
    & (Join-Path $TempRoot 'Setup-FictionlogWriter.ps1') -TunnelId 'tunnel-fictionlog-test-2' -OrganizationId 'org-fictionlog-test-2' -HealthPort $port2 -FillMissing | Out-Null
    Assert-True ((Unprotect-FictionlogWriterApiKey -Root $TempRoot) -eq $api) 'FillMissing failed to reuse API key'
    Write-Host 'fill-missing reuses API key: PASS'

    & (Join-Path $TempRoot 'Clear-FictionlogWriterSettings.ps1') -Mode credential -Force | Out-Null
    Assert-True ([string]::IsNullOrWhiteSpace((Unprotect-FictionlogWriterApiKey -Root $TempRoot))) 'credential clear failed'
    Assert-True ($null -ne (Get-FictionlogWriterSettings -Root $TempRoot)) 'credential clear removed connection settings'
    Write-Host 'credential clear preserves connection settings: PASS'

    Protect-FictionlogWriterApiKey -Root $TempRoot -ApiKey $api | Out-Null
    & (Join-Path $TempRoot 'Clear-FictionlogWriterSettings.ps1') -Mode all -Force | Out-Null
    Assert-True ($null -eq (Get-FictionlogWriterSettings -Root $TempRoot)) 'clear all left settings'
    Assert-True ([string]::IsNullOrWhiteSpace((Unprotect-FictionlogWriterApiKey -Root $TempRoot))) 'clear all left API key'
    Assert-True (-not (Test-Path (Join-Path $TempRoot 'mcp-conf.yaml'))) 'clear all left profile'
    Assert-True (Test-Path (Join-Path $TempRoot 'runtime') -PathType Container) 'clear all did not recreate tunnel runtime'
    Assert-True (Test-Path (Join-Path $TempRoot 'logs') -PathType Container) 'clear all did not recreate logs'
    Assert-True (Test-Path (Join-Path $TempRoot 'fictionlogwriter-runtime\profile-marker.txt')) 'clear all deleted persistent browser state'
    Write-Host 'clear all preserves persistent browser runtime: PASS'

    $startText=Get-Content -LiteralPath (Join-Path $SourceRoot 'Start-FictionlogWriter.ps1') -Raw
    Assert-True ($startText -match 'FIRST_RUN_REQUIRED') 'non-interactive first-run guard missing'
    Assert-True ($startText -match 'Write-FictionlogWriterProfile') 'Start does not regenerate profile'
    $restartText=Get-Content -LiteralPath (Join-Path $SourceRoot 'Restart-FictionlogWriter.ps1') -Raw
    Assert-True ($restartText -match 'RESTART_CONNECTION_NOT_CONFIGURED') 'Restart connection preflight missing'
    Assert-True ($restartText -match 'RESTART_CREDENTIAL_NOT_CONFIGURED') 'Restart credential preflight missing'
    Write-Host 'start/restart wiring: PASS'
}
finally {
    if(Test-Path $TempRoot){Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue}
}
