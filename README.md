# FictionlogWriter

Focused MCP server for ChatGPT-assisted writing workflows on Fictionlog.

- Current version: **0.1.0**
- Release target: **v0.1.0 — Focused Fictionlog Browser Bridge**
- Public MCP surface: **8 tools**

## Scope

FictionlogWriter intentionally exposes only eight managed-browser tools:

- `browser_start`
- `browser_stop`
- `browser_tabs`
- `browser_navigate`
- `browser_snapshot`
- `browser_click`
- `browser_type`
- `browser_screenshot`

Firefox is the only exposed browser backend. Navigation is restricted to HTTPS URLs on `fictionlog.co` and `www.fictionlog.co`.

## Local runtime layout

Generated tunnel state and persistent browser state are deliberately separated:

```text
runtime/                         # generated tunnel PID/health state
logs/                            # generated tunnel logs
local-secrets/                   # local connection settings and encrypted API key
fictionlogwriter-runtime/        # persistent Firefox profile + geckodriver
```

`Clear-FictionlogWriterSettings.cmd -Mode all` clears generated tunnel state but preserves `fictionlogwriter-runtime/`, so Fictionlog login/profile data is not intentionally removed.

## Tunnel connection setup

Run:

```text
Setup-FictionlogWriter.cmd
```

The setup stores:

- Tunnel ID / Organization ID / health port in `local-secrets\FictionlogWriter-settings.json`
- Runtime API key separately in `local-secrets\FictionlogWriter-api-key.dpapi` using Windows DPAPI / CurrentUser
- generated `mcp-conf.yaml` with API key environment indirection

Operator commands:

```text
Setup-FictionlogWriter.cmd
Start-FictionlogWriter.cmd
Stop-FictionlogWriter.cmd
Status-FictionlogWriter.cmd
Restart-FictionlogWriter.cmd
Clear-FictionlogWriterSettings.cmd
```

Clear modes:

- `credential` — API key only
- `connection` — Tunnel ID / Organization ID / health port + generated profile
- `all` — both above plus generated tunnel runtime/logs; persistent browser runtime is preserved

## Conditional read cache

Only the read-only tools `browser_tabs` and `browser_snapshot` support:

- `known_digest`
- `cache_max_age_ms` (0–300000)

Successful responses include SHA-256 conditional-read metadata:

- `result_digest_sha256`
- `not_modified`
- `result_suppressed`
- `cache_hit`
- `execution_skipped`
- `cache_age_ms`
- `content_retained`

The cache retains digest/size/timestamp metadata only. It does not retain browser result content. Cache keys hash canonical read arguments so selectors/text are not stored as raw cache-key metadata.

`browser_start`, `browser_stop`, `browser_navigate`, `browser_click`, and `browser_type` invalidate the read cache. Mutating browser operations are never cached. Screenshot results are not cached.

## Development

```powershell
npm install
npm test
npm audit
```

Windows lifecycle qualification:

```powershell
powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File .\tests\tunnel-lifecycle-smoke.ps1
```

## Safety

No tunnel credentials, local secrets, browser profile data, `mcp-conf.yaml`, or `tunnel-client.exe` are committed.

## License

MIT
