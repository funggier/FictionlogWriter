[CmdletBinding()]
param(
    [ValidateSet('credential','connection','all')][string]$Mode,
    [switch]$Force
)
$ErrorActionPreference='Stop'
$Root=$PSScriptRoot
. (Join-Path $Root 'scripts\FictionlogWriterSettings.ps1')
$p=Get-FictionlogWriterPaths -Root $Root
if ([string]::IsNullOrWhiteSpace($Mode)) {
    Write-Host '1. Clear API key only'
    Write-Host '2. Clear connection settings (Tunnel ID / Organization / Port)'
    Write-Host '3. Clear ALL generated tunnel state (persistent browser profile is preserved)'
    Write-Host '0. Cancel'
    switch (Read-Host 'Select') {
        '1' {$Mode='credential'}
        '2' {$Mode='connection'}
        '3' {$Mode='all'}
        default { Write-Host 'Cancelled.'; exit 0 }
    }
}
if (-not $Force) {
    $answer=Read-Host "Confirm clear mode '$Mode'? [y/N]"
    if ($answer -notmatch '^(?i)y(es)?$') { Write-Host 'Clear cancelled.'; exit 0 }
}
if ($Mode -in @('credential','all')) {
    Remove-Item -LiteralPath $p.ApiKeyFile -Force -ErrorAction SilentlyContinue
    Write-Host 'API key: cleared'
}
if ($Mode -in @('connection','all')) {
    Remove-Item -LiteralPath $p.SettingsFile,$p.ProfileFile -Force -ErrorAction SilentlyContinue
    Write-Host 'Connection settings/profile: cleared'
}
if ($Mode -eq 'all') {
    $state=Clear-FictionlogWriterGeneratedState -Root $Root
    Write-Host "Tunnel runtime/logs: cleared"
    Write-Host "Persistent browser runtime preserved: $($state.persistent_runtime)"
}
Write-Host 'Clear result: PASS'
