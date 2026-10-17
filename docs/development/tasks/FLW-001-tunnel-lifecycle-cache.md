# FLW-001 — Tunnel Lifecycle & Conditional Read Cache

**Status:** COMPLETE / DEPLOYED / LIVE GREEN

## Goal

Align FictionlogWriter with the connection-management and context-efficiency baseline used by Base-Plugin-for-ChatGPT, LConnect/BConnect, and VGate without expanding the focused eight-tool browser surface.

## Acceptance

- self-contained Setup/Start/Stop/Status/Restart/Clear lifecycle in the FictionlogWriter repo
- Tunnel ID / Organization ID / health port stored separately from Runtime API key
- persistent Firefox profile/geckodriver separated from generated tunnel runtime
- Clear all preserves persistent browser runtime
- browser_tabs and browser_snapshot support digest conditional reads
- browser mutations invalidate read-cache metadata
- no mutating browser operation is cached
- exactly eight public MCP tools remain
- local tests and Windows lifecycle smoke pass
- exact pushed commit CI passes before live migration
- existing tunnel identity and Fictionlog browser profile are preserved during live migration
