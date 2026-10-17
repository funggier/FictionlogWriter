import test from "node:test";
import assert from "node:assert/strict";
import { BrowserCommonLayer } from "../modules/browser-common.mjs";
import { FictionlogBrowserLayer } from "../modules/fictionlog-policy.mjs";
import { FICTIONLOG_TOOL_NAMES, registerFictionlogTools } from "../modules/fictionlog-tools.mjs";

function fakeServer() {
  const names = [];
  return {
    names,
    tool(name) { names.push(name); }
  };
}

test("public MCP surface contains exactly eight focused browser tools", () => {
  const server = fakeServer();
  const layer = new FictionlogBrowserLayer(new BrowserCommonLayer(), { firefoxProfileRoot: "X:/profile" });
  registerFictionlogTools(server, layer);
  assert.deepEqual([...server.names].sort(), [...FICTIONLOG_TOOL_NAMES].sort());
  assert.equal(server.names.length, 8);
});

test("managed start forces dedicated Firefox profile and Fictionlog URL", async () => {
  let received = null;
  const inner = { async start(args) { received = args; return { ok: true }; } };
  const layer = new FictionlogBrowserLayer(inner, { firefoxProfileRoot: "X:/fictionlog-profile", geckodriverPath: "X:/fictionlog-driver/geckodriver.exe" });
  await layer.start({ browser: "firefox", url: "https://fictionlog.co/", options: {} });
  assert.equal(received.browser, "firefox");
  assert.equal(received.options.profile_root, "X:/fictionlog-profile");
  assert.equal(received.options.geckodriver_path, "X:/fictionlog-driver/geckodriver.exe");
  assert.equal(received.options.unsafe_allow_external_profile, true);
});

test("managed start rejects Chrome", async () => {
  const layer = new FictionlogBrowserLayer({ start() { throw new Error("should not run"); } }, { firefoxProfileRoot: "X:/profile" });
  await assert.rejects(() => layer.start({ browser: "chrome", url: "https://fictionlog.co/" }), /FICTIONLOG_BROWSER_UNSUPPORTED/);
});
