# FictionlogWriter

Focused MCP server for ChatGPT-assisted writing workflows on Fictionlog.

## Scope

This project intentionally exposes only the browser capabilities required to operate Fictionlog. It is derived from the browser-control work used by LConnect, but general filesystem, shell, process, system, network, Git, GitHub, service, scheduled-task, hardware, desktop-input, and live-browser UI Automation tools are not exposed by this runtime.

## Public MCP surface

Exactly eight managed-browser tools are registered:

- `browser_start`
- `browser_stop`
- `browser_tabs`
- `browser_navigate`
- `browser_snapshot`
- `browser_click`
- `browser_type`
- `browser_screenshot`

Firefox is the only managed browser backend exposed by FictionlogWriter.

## Browser model

Navigation through `browser_start` and `browser_navigate` is restricted to HTTPS URLs on `fictionlog.co` / `www.fictionlog.co`.

A dedicated persistent Firefox profile is stored under `runtime/firefox-profile`. This allows Fictionlog login state to persist without reusing the user's normal Firefox profile.

The existing ChatGPT local tunnel/plugin binding can be retained. For an already-connected installation, keep its tunnel ID, Runtime API key, Organization ID, and control-plane settings unchanged and change only the `main` MCP command to the FictionlogWriter entry point.

## Installation

```powershell
npm install
npm test
npm start
```

Firefox and a compatible `geckodriver` are required. The deployed runtime pins its driver path under `fictionlogwriter/runtime/browser-drivers/geckodriver.exe`, outside the tunnel client's generated `runtime/` directory, so a normal tunnel refresh does not remove the browser driver.

## Qualification baseline

The baseline test suite verifies:

- Fictionlog HTTPS URLs are allowed.
- non-Fictionlog hosts are rejected.
- non-HTTPS Fictionlog URLs are rejected.
- exactly eight public tools are registered.
- the dedicated Firefox profile is forced for managed sessions.
- Chrome is rejected by the focused runtime.

Runtime qualification also verifies that Fictionlog can be opened and read, an external-domain navigation is blocked, and removed LConnect tools are not callable.

## Safety

No tunnel credentials, local secrets, browser profile data, or `mcp-conf.yaml` are committed to this repository.

## License

MIT
