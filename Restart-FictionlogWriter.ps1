[CmdletBinding()]
param([ValidateRange(250,10000)][int]$DelayMilliseconds=1200,[ValidateRange(10,120)][int]$ReadyTimeoutSeconds=45)
$ErrorActionPreference='Stop'
$Root=$PSScriptRoot
. (Join-Path $Root 'scripts\FictionlogWriterSettings.ps1')
$settings=Get-FictionlogWriterSettings -Root $Root
$api=$null
try { $api=Unprotect-FictionlogWriterApiKey -Root $Root } catch {}
if (-not $settings) { throw 'RESTART_CONNECTION_NOT_CONFIGURED: Run Setup-FictionlogWriter.cmd first.' }
if ([string]::IsNullOrWhiteSpace($api)) { throw 'RESTART_CREDENTIAL_NOT_CONFIGURED: Run Setup-FictionlogWriter.cmd first.' }
Remove-Variable api -ErrorAction SilentlyContinue
$worker=Join-Path $Root 'scripts\Restart-FictionlogWriterWorker.ps1'
function Quote-Ps([string]$Value) { "'" + ($Value -replace "'","''") + "'" }
$ps=(Get-Command powershell.exe -ErrorAction Stop).Source
$command="& {0} -Root {1} -DelayMilliseconds {2} -ReadyTimeoutSeconds {3}" -f (Quote-Ps $worker),(Quote-Ps $Root),$DelayMilliseconds,$ReadyTimeoutSeconds
$encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
$line=('"{0}" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand {1}' -f $ps,$encoded)
$startup=([WmiClass]'Win32_ProcessStartup').CreateInstance(); $startup.ShowWindow=0
$result=([WmiClass]'Win32_Process').Create($line,$Root,$startup)
if ([int]$result.ReturnValue -ne 0 -or [int]$result.ProcessId -le 0) { throw "RESTART_SCHEDULE_FAILED: $($result.ReturnValue)" }
Write-Host "FictionlogWriter restart scheduled (worker PID $($result.ProcessId))."
