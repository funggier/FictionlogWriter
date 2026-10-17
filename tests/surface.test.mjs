import test from "node:test";
import assert from "node:assert/strict";
import { BrowserCommonLayer } from "../modules/browser-common.mjs";
import { FictionlogBrowserLayer } from "../modules/fictionlog-policy.mjs";
import { FICTIONLOG_TOOL_NAMES, registerFictionlogTools } from "../modules/fictionlog-tools.mjs";

function fakeServer() {
  const names = [];
  const tools = new Map();
  return {
    names,
    tools,
    tool(name, description, schema, handler) {
      names.push(name);
      tools.set(name, { description, schema, handler });
    }
  };
}

function parseToolText(result) {
  return JSON.parse(result.content[0].text);
}

test("public MCP surface contains exactly eight focused browser tools", () => {
  const server = fakeServer();
  const layer = new FictionlogBrowserLayer(new BrowserCommonLayer(), { firefoxProfileRoot: "X:/profile" });
  registerFictionlogTools(server, layer);
  assert.deepEqual([...server.names].sort(), [...FICTIONLOG_TOOL_NAMES].sort());
  assert.equal(server.names.length, 8);
});

test("only read-only tabs and snapshot tools expose conditional read inputs", () => {
  const server = fakeServer();
  const layer = new FictionlogBrowserLayer(new BrowserCommonLayer(), { firefoxProfileRoot: "X:/profile" });
  registerFictionlogTools(server, layer);

  for (const name of ["browser_tabs", "browser_snapshot"]) {
    const schema = server.tools.get(name).schema;
    assert.ok(Object.hasOwn(schema, "known_digest"));
    assert.ok(Object.hasOwn(schema, "cache_max_age_ms"));
  }

  for (const name of [
    "browser_start",
    "browser_stop",
    "browser_navigate",
    "browser_click",
    "browser_type",
    "browser_screenshot",
  ]) {
    const schema = server.tools.get(name).schema;
    assert.equal(Object.hasOwn(schema, "known_digest"), false, name);
    assert.equal(Object.hasOwn(schema, "cache_max_age_ms"), false, name);
  }
});

test("browser_tabs supports digest short-circuit and mutation invalidates cache", async () => {
  let tabExecutions = 0;
  let navigations = 0;
  const layer = {
    async tabs(args) {
      tabExecutions += 1;
      return {
        ok: true,
        browser_session_id: args.browser_session_id,
        browser: "firefox",
        result: { tabs: [{ id: "tab-1", url: "https://fictionlog.co/" }] }
      };
    },
    async navigate(args) {
      navigations += 1;
      return { ok: true, browser_session_id: args.browser_session_id, result: { url: args.url } };
    }
  };
  const server = fakeServer();
  registerFictionlogTools(server, layer);

  const first = parseToolText(await server.tools.get("browser_tabs").handler({
    browser_session_id: "browser-1"
  }));
  assert.match(first.result_digest_sha256, /^[0-9a-f]{64}$/);
  assert.equal(first.cache_hit, false);
  assert.equal(tabExecutions, 1);

  const cached = parseToolText(await server.tools.get("browser_tabs").handler({
    browser_session_id: "browser-1",
    known_digest: first.result_digest_sha256,
    cache_max_age_ms: 60000
  }));
  assert.equal(cached.not_modified, true);
  assert.equal(cached.result_suppressed, true);
  assert.equal(cached.cache_hit, true);
  assert.equal(cached.execution_skipped, true);
  assert.equal(cached.returned_chars, 0);
  assert.equal(tabExecutions, 1);

  await server.tools.get("browser_navigate").handler({
    browser_session_id: "browser-1",
    url: "https://fictionlog.co/library"
  });
  assert.equal(navigations, 1);

  const afterMutation = parseToolText(await server.tools.get("browser_tabs").handler({
    browser_session_id: "browser-1",
    known_digest: first.result_digest_sha256,
    cache_max_age_ms: 60000
  }));
  assert.equal(afterMutation.not_modified, true);
  assert.equal(afterMutation.cache_hit, false);
  assert.equal(afterMutation.execution_skipped, false);
  assert.equal(tabExecutions, 2);
});

test("browser_snapshot TTL zero revalidates and suppresses unchanged content", async () => {
  let executions = 0;
  const layer = {
    async snapshot(args) {
      executions += 1;
      return {
        ok: true,
        browser_session_id: args.browser_session_id,
        browser: "firefox",
        result: { text: "same snapshot" }
      };
    }
  };
  const server = fakeServer();
  registerFictionlogTools(server, layer);

  const first = parseToolText(await server.tools.get("browser_snapshot").handler({
    browser_session_id: "browser-1",
    mode: "text"
  }));

  const revalidated = parseToolText(await server.tools.get("browser_snapshot").handler({
    browser_session_id: "browser-1",
    mode: "text",
    known_digest: first.result_digest_sha256,
    cache_max_age_ms: 0
  }));

  assert.equal(revalidated.not_modified, true);
  assert.equal(revalidated.result_suppressed, true);
  assert.equal(revalidated.cache_hit, false);
  assert.equal(revalidated.execution_skipped, false);
  assert.equal(revalidated.returned_chars, 0);
  assert.equal(executions, 2);
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
