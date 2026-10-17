[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Root,[int]$DelayMilliseconds=1200,[int]$ReadyTimeoutSeconds=45)
$ErrorActionPreference='Stop'
$logs=Join-Path $Root 'logs'; New-Item -ItemType Directory -Force -Path $logs | Out-Null
$log=Join-Path $logs ("restart-"+(Get-Date -Format 'yyyyMMdd-HHmmss')+".log")
function Log([string]$m){Add-Content -LiteralPath $log -Value ("[{0}] {1}" -f ([DateTimeOffset]::Now.ToString('o')),$m)}
try {
    Start-Sleep -Milliseconds $DelayMilliseconds
    Log 'Stopping FictionlogWriter tunnel.'
    & (Join-Path $Root 'Stop-FictionlogWriter.ps1') *>> $log
    Log 'Starting FictionlogWriter tunnel.'
    & (Join-Path $Root 'Start-FictionlogWriter.ps1') -NonInteractive *>> $log
    $deadline=(Get-Date).AddSeconds($ReadyTimeoutSeconds)
    do {
        Start-Sleep -Milliseconds 500
        & (Join-Path $Root 'Status-FictionlogWriter.ps1') *>> $log
        $status=$LASTEXITCODE
    } while($status -ne 0 -and (Get-Date) -lt $deadline)
    if($status -ne 0){throw "FictionlogWriter did not become healthy within $ReadyTimeoutSeconds seconds."}
    Log 'Restart qualification PASS.'
} catch { Log ("Restart FAILED: "+$_.Exception.Message); exit 1 }
