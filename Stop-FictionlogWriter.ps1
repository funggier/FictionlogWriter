[CmdletBinding()]param()
$ErrorActionPreference='Stop'
$Root=$PSScriptRoot
. (Join-Path $Root 'scripts\FictionlogWriterSettings.ps1')
$p=Get-FictionlogWriterPaths -Root $Root
if (-not (Test-Path -LiteralPath $p.LauncherPid)) { Write-Host 'FictionlogWriter is not running.'; exit 0 }
$raw=(Get-Content -LiteralPath $p.LauncherPid -Raw).Trim()
$id=0
if (-not [int]::TryParse($raw,[ref]$id)) { Remove-Item -LiteralPath $p.LauncherPid -Force; Write-Host 'Removed invalid PID file.'; exit 0 }
if (-not (Get-Process -Id $id -ErrorAction SilentlyContinue)) { Remove-Item -LiteralPath $p.LauncherPid -Force; Write-Host 'Removed stale PID file.'; exit 0 }
$output=& taskkill.exe /PID $id /T /F 2>&1
if ($LASTEXITCODE -ne 0) { throw ('Failed to stop FictionlogWriter process tree: '+($output|Out-String)) }
Remove-Item -LiteralPath $p.LauncherPid,$p.TunnelPid,$p.HealthUrl -Force -ErrorAction SilentlyContinue
Write-Host "FictionlogWriter process tree stopped (root PID $id)."
