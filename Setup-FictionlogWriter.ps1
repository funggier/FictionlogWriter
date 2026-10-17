[CmdletBinding()]
param(
    [string]$TunnelId,
    [string]$ApiKey,
    [string]$OrganizationId,
    [int]$HealthPort = 0,
    [switch]$Force,
    [switch]$FillMissing
)
$ErrorActionPreference='Stop'
$Root=$PSScriptRoot
. (Join-Path $Root 'scripts\FictionlogWriterSettings.ps1')
$existing=Get-FictionlogWriterSettings -Root $Root
$existingApi=$null
try { $existingApi=Unprotect-FictionlogWriterApiKey -Root $Root } catch {}

if ($existing -and -not $Force -and -not $FillMissing) {
    $answer=Read-Host 'Existing FictionlogWriter connection settings found. Reconfigure them? [y/N]'
    if ($answer -notmatch '^(?i)y(es)?$') { Write-Host 'Setup cancelled.'; exit 0 }
}
if ($FillMissing) {
    if ([string]::IsNullOrWhiteSpace($TunnelId) -and $existing) { $TunnelId=[string]$existing.tunnel_id }
    if ([string]::IsNullOrWhiteSpace($OrganizationId) -and $existing) { $OrganizationId=[string]$existing.organization_id }
    if ($HealthPort -eq 0 -and $existing) { $HealthPort=[int]$existing.health_port }
    if ([string]::IsNullOrWhiteSpace($ApiKey) -and -not [string]::IsNullOrWhiteSpace($existingApi)) { $ApiKey=$existingApi }
}
if ([string]::IsNullOrWhiteSpace($TunnelId)) {
    do { $TunnelId=Read-Host '1/4 Tunnel ID (tunnel_...)' } while ([string]::IsNullOrWhiteSpace($TunnelId))
}
if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    $secure=Read-Host '2/4 Runtime API key (input hidden)' -AsSecureString
    $bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $ApiKey=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
if ([string]::IsNullOrWhiteSpace($OrganizationId)) {
    do { $OrganizationId=Read-Host '3/4 Organization ID (org_... or org-...)' } while ([string]::IsNullOrWhiteSpace($OrganizationId))
}
if ($HealthPort -eq 0) {
    while ($true) {
        $raw=Read-Host '4/4 Local health port [18010]'
        $candidate=0
        if ([string]::IsNullOrWhiteSpace($raw)) { $candidate=18010 }
        elseif (-not [int]::TryParse($raw,[ref]$candidate)) { continue }
        if ($candidate -lt 1024 -or $candidate -gt 65535) { continue }
        if (-not (Test-FictionlogWriterPortAvailable -Port $candidate)) { Write-Host "Port $candidate is already in use."; continue }
        $HealthPort=$candidate
        break
    }
}
elseif ($HealthPort -lt 1024 -or $HealthPort -gt 65535) { throw 'HealthPort must be between 1024 and 65535.' }
elseif (-not ($FillMissing -and $existing -and [int]$existing.health_port -eq $HealthPort) -and -not (Test-FictionlogWriterPortAvailable -Port $HealthPort)) {
    throw "HealthPort $HealthPort is already in use."
}

try {
    $settingsPath=Save-FictionlogWriterSettings -Root $Root -TunnelId $TunnelId -OrganizationId $OrganizationId -HealthPort $HealthPort
    $apiPath=Protect-FictionlogWriterApiKey -Root $Root -ApiKey $ApiKey
    $profile=Write-FictionlogWriterProfile -Root $Root
    Write-Host 'Setup result: PASS'
    Write-Host "Tunnel ID: $TunnelId"
    Write-Host "Organization ID: $OrganizationId"
    Write-Host "Health port: $HealthPort"
    Write-Host "Settings: $settingsPath"
    Write-Host "API key: configured (Windows DPAPI CurrentUser)"
    Write-Host "Generated profile: $profile"
}
finally { Remove-Variable ApiKey,existingApi -ErrorAction SilentlyContinue }
