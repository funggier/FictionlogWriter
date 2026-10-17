# FictionlogWriter

Focused MCP server for ChatGPT-assisted writing workflows on [Fictionlog](https://fictionlog.co/).

## Scope

This project intentionally exposes only browser capabilities needed to operate Fictionlog. It is derived from the browser-control work used by LConnect, but removes general filesystem, shell, process, system, network, Git, GitHub, service, scheduled-task, and hardware tools from the public MCP surface.

### Browser model

- Firefox is the managed browser backend.
- Navigation is restricted to HTTPS URLs on `fictionlog.co` / `www.fictionlog.co`.
- A dedicated persistent profile is stored under `runtime/firefox-profile` so Fictionlog login state can persist without using the user's normal Firefox profile.
- Live-browser UI Automation remains available for interacting with an already-open Firefox window when needed.
- The existing ChatGPT local tunnel/plugin connection can continue using the same main-channel transport; only the MCP command changes to `node "fictionlogwriter-mcp.mjs"`.

## Installation

```powershell
npm install
npm test
npm start
```

For an existing local tunnel installation, keep its tunnel ID, credentials, and control-plane settings unchanged and point the `main` MCP command at `fictionlogwriter-mcp.mjs`.

## Safety

No tunnel credentials, local secrets, browser profile data, or `mcp-conf.yaml` are committed to this repository.

## License

MIT
