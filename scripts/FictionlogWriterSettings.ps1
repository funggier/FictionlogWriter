$script:FictionlogWriterSettingsVersion = 1

function Get-FictionlogWriterPaths {
    param([Parameter(Mandatory=$true)][string]$Root)
    $LocalSecrets = Join-Path $Root 'local-secrets'
    $Runtime = Join-Path $Root 'runtime'
    $PersistentRuntime = Join-Path $Root 'fictionlogwriter-runtime'
    $Logs = Join-Path $Root 'logs'
    [pscustomobject]@{
        Root = $Root
        LocalSecrets = $LocalSecrets
        Runtime = $Runtime
        PersistentRuntime = $PersistentRuntime
        Logs = $Logs
        SettingsFile = Join-Path $LocalSecrets 'FictionlogWriter-settings.json'
        ApiKeyFile = Join-Path $LocalSecrets 'FictionlogWriter-api-key.dpapi'
        ProfileFile = Join-Path $Root 'mcp-conf.yaml'
        LauncherPid = Join-Path $Runtime 'launcher.pid'
        TunnelPid = Join-Path $Runtime 'tunnel-client.pid'
        HealthUrl = Join-Path $Runtime 'health-url.txt'
    }
}

function Test-FictionlogWriterPortAvailable {
    param([Parameter(Mandatory=$true)][int]$Port)
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
        $listener.Start()
        $listener.Stop()
        return $true
    }
    catch {
        try { if ($listener) { $listener.Stop() } } catch {}
        return $false
    }
}

function Protect-FictionlogWriterApiKey {
    param(
        [Parameter(Mandatory=$true)][string]$Root,
        [Parameter(Mandatory=$true)][string]$ApiKey
    )
    if ([string]::IsNullOrWhiteSpace($ApiKey)) { throw 'Runtime API key cannot be empty.' }
    $p = Get-FictionlogWriterPaths -Root $Root
    New-Item -ItemType Directory -Force -Path $p.LocalSecrets | Out-Null
    $secure = ConvertTo-SecureString $ApiKey -AsPlainText -Force
    $encrypted = ConvertFrom-SecureString $secure
    Set-Content -LiteralPath $p.ApiKeyFile -Value $encrypted -Encoding UTF8
    return $p.ApiKeyFile
}

function Unprotect-FictionlogWriterApiKey {
    param([Parameter(Mandatory=$true)][string]$Root)
    $p = Get-FictionlogWriterPaths -Root $Root
    if (-not (Test-Path -LiteralPath $p.ApiKeyFile -PathType Leaf)) { return $null }
    $encrypted = (Get-Content -LiteralPath $p.ApiKeyFile -Raw).Trim()
    $secure = ConvertTo-SecureString $encrypted
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

function Get-FictionlogWriterSettings {
    param([Parameter(Mandatory=$true)][string]$Root)
    $p = Get-FictionlogWriterPaths -Root $Root
    if (-not (Test-Path -LiteralPath $p.SettingsFile -PathType Leaf)) { return $null }
    $settings = Get-Content -LiteralPath $p.SettingsFile -Raw | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace([string]$settings.tunnel_id) -or
        [string]::IsNullOrWhiteSpace([string]$settings.organization_id) -or
        [int]$settings.health_port -lt 1024 -or [int]$settings.health_port -gt 65535) {
        throw 'CONNECTION_SETTINGS_INVALID: Tunnel ID, Organization ID, or health port is invalid.'
    }
    return $settings
}

function Save-FictionlogWriterSettings {
    param(
        [Parameter(Mandatory=$true)][string]$Root,
        [Parameter(Mandatory=$true)][string]$TunnelId,
        [Parameter(Mandatory=$true)][string]$OrganizationId,
        [Parameter(Mandatory=$true)][ValidateRange(1024,65535)][int]$HealthPort
    )
    if ([string]::IsNullOrWhiteSpace($TunnelId)) { throw 'Tunnel ID cannot be empty.' }
    if ([string]::IsNullOrWhiteSpace($OrganizationId)) { throw 'Organization ID cannot be empty.' }
    $p = Get-FictionlogWriterPaths -Root $Root
    New-Item -ItemType Directory -Force -Path $p.LocalSecrets | Out-Null
    $obj = [ordered]@{
        version = $script:FictionlogWriterSettingsVersion
        tunnel_id = $TunnelId
        organization_id = $OrganizationId
        health_port = $HealthPort
        updated_at = [DateTimeOffset]::UtcNow.ToString('o')
    }
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($p.SettingsFile,(($obj | ConvertTo-Json)+[Environment]::NewLine),$utf8)
    return $p.SettingsFile
}

function Write-FictionlogWriterProfile {
    param([Parameter(Mandatory=$true)][string]$Root)
    $settings = Get-FictionlogWriterSettings -Root $Root
    if (-not $settings) { throw 'FictionlogWriter settings are not configured. Run Setup-FictionlogWriter.cmd first.' }
    $p = Get-FictionlogWriterPaths -Root $Root
    New-Item -ItemType Directory -Force -Path $p.Runtime | Out-Null
    $yaml = @"
# Generated from local-secrets\FictionlogWriter-settings.json.
config_version: 1

control_plane:
  base_url: "https://api.openai.com"
  tunnel_id: "$($settings.tunnel_id)"
  api_key: "env:CONTROL_PLANE_API_KEY"

health:
  listen_addr: "127.0.0.1:$($settings.health_port)"
  url_file: "runtime/health-url.txt"

admin_ui:
  open_browser: false

log:
  level: info
  format: json

mcp:
  commands:
    - channel: main
      command: 'node "fictionlogwriter-mcp.mjs"'
"@
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($p.ProfileFile,$yaml+[Environment]::NewLine,$utf8)
    return $p.ProfileFile
}

function Clear-FictionlogWriterGeneratedState {
    param([Parameter(Mandatory=$true)][string]$Root)
    $p = Get-FictionlogWriterPaths -Root $Root
    if (Test-Path -LiteralPath $p.Runtime) { Remove-Item -LiteralPath $p.Runtime -Recurse -Force -ErrorAction Stop }
    if (Test-Path -LiteralPath $p.Logs) { Remove-Item -LiteralPath $p.Logs -Recurse -Force -ErrorAction Stop }
    New-Item -ItemType Directory -Force -Path $p.Runtime,$p.Logs,$p.PersistentRuntime | Out-Null
    [pscustomobject]@{
        runtime_cleared = $true
        logs_cleared = $true
        persistent_runtime_preserved = $true
        persistent_runtime = $p.PersistentRuntime
    }
}
