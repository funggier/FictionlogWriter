import test from "node:test";
import assert from "node:assert/strict";
import { registerBrowserCommonTools, BrowserCommonLayer } from "../modules/browser-common.mjs";
import { registerBrowserLiveTools } from "../modules/browser-live.mjs";
import { FictionlogBrowserLayer } from "../modules/fictionlog-policy.mjs";

function fakeServer() {
  const names = [];
  return {
    names,
    tool(name) { names.push(name); }
  };
}

test("public MCP surface contains browser tools only", () => {
  const server = fakeServer();
  const inner = new BrowserCommonLayer();
  const layer = new FictionlogBrowserLayer(inner, { firefoxProfileRoot: "X:/profile" });
  registerBrowserCommonTools(server, {}, layer);
  registerBrowserLiveTools(server, { shell: { maxTimeoutSeconds: 12, maxOutputChars: 250000 } });

  const expected = [
    "browser_start","browser_attach","browser_stop","browser_tabs","browser_navigate",
    "browser_snapshot","browser_click","browser_type","browser_screenshot",
    "browser_live_attach","browser_live_tabs","browser_live_snapshot",
    "browser_live_click","browser_live_type","browser_live_stop"
  ].sort();

  assert.deepEqual([...server.names].sort(), expected);
  assert.equal(server.names.some((name) => /^(git_|github_|powershell_|command_|read_|write_|system_|process_)/.test(name)), false);
});

test("managed start forces dedicated Firefox profile and Fictionlog URL", async () => {
  let received = null;
  const inner = {
    async start(args) { received = args; return { ok: true }; }
  };
  const layer = new FictionlogBrowserLayer(inner, { firefoxProfileRoot: "X:/fictionlog-profile" });
  await layer.start({ browser: "firefox", url: "https://fictionlog.co/", options: { log_level: "info" } });

  assert.equal(received.browser, "firefox");
  assert.equal(received.options.profile_root, "X:/fictionlog-profile");
  assert.equal(received.options.unsafe_allow_external_profile, true);
  assert.equal(received.options.log_level, "info");
});

test("managed start rejects Chrome in focused runtime", async () => {
  const layer = new FictionlogBrowserLayer({ start() { throw new Error("should not run"); } }, { firefoxProfileRoot: "X:/profile" });
  await assert.rejects(() => layer.start({ browser: "chrome", url: "https://fictionlog.co/" }), /FICTIONLOG_BROWSER_UNSUPPORTED/);
});
