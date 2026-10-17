import { z } from "zod";

const sessionId = z.string().min(1).max(128);
const url = z.string().url().max(8192);
const target = z.union([
  z.string().min(1).max(4096),
  z.object({
    selector: z.string().min(1).max(4096).optional(),
    text: z.string().min(1).max(4096).optional(),
    role: z.string().min(1).max(128).optional(),
    name: z.string().min(1).max(1024).optional(),
    index: z.number().int().min(0).max(10000).optional(),
  }).strict(),
]);

function textResult(value, isError = false) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: "text", text }], ...(isError ? { isError: true } : {}) };
}

async function call(fn) {
  try { return textResult(await fn()); }
  catch (error) { return textResult(error?.message || String(error), true); }
}

export const FICTIONLOG_TOOL_NAMES = Object.freeze([
  "browser_start",
  "browser_stop",
  "browser_tabs",
  "browser_navigate",
  "browser_snapshot",
  "browser_click",
  "browser_type",
  "browser_screenshot",
]);

export function registerFictionlogTools(server, layer) {
  server.tool("browser_start", "Start the dedicated managed Firefox session for Fictionlog.", {
    browser: z.literal("firefox").optional(),
    url: url.optional(),
    headless: z.boolean().optional(),
  }, async ({ browser = "firefox", url: startUrl, headless = false }) =>
    call(() => layer.start({ browser, url: startUrl, headless, options: {} })));

  server.tool("browser_stop", "Stop a FictionlogWriter managed browser session.", {
    browser_session_id: sessionId,
    close_remote_session: z.boolean().optional(),
  }, async (args) => call(() => layer.stop(args)));

  server.tool("browser_tabs", "List tabs in a FictionlogWriter managed browser session.", {
    browser_session_id: sessionId,
  }, async (args) => call(() => layer.tabs(args)));

  server.tool("browser_navigate", "Navigate the managed browser. Only Fictionlog HTTPS URLs are allowed.", {
    browser_session_id: sessionId,
    url,
    tab_id: z.string().min(1).max(256).optional(),
    wait: z.enum(["none", "interactive", "complete"]).optional(),
    timeout_ms: z.number().int().min(100).max(120000).optional(),
  }, async (args) => call(() => layer.navigate(args)));

  server.tool("browser_snapshot", "Read a bounded DOM snapshot from the Fictionlog browser.", {
    browser_session_id: sessionId,
    tab_id: z.string().min(1).max(256).optional(),
    target: target.optional(),
    max_chars: z.number().int().min(1000).max(250000).optional(),
    mode: z.enum(["dom", "text"]).optional(),
    include_state: z.boolean().optional(),
  }, async (args) => call(() => layer.snapshot(args)));

  server.tool("browser_click", "Click an element in the Fictionlog browser.", {
    browser_session_id: sessionId,
    tab_id: z.string().min(1).max(256).optional(),
    target,
    button: z.enum(["left", "middle", "right"]).optional(),
    click_count: z.number().int().min(1).max(3).optional(),
  }, async (args) => call(() => layer.click(args)));

  server.tool("browser_type", "Type text into an element in the Fictionlog browser.", {
    browser_session_id: sessionId,
    tab_id: z.string().min(1).max(256).optional(),
    target,
    text: z.string().max(500000),
    clear: z.boolean().optional(),
  }, async (args) => call(() => layer.type(args)));

  server.tool("browser_screenshot", "Capture a screenshot from the Fictionlog browser.", {
    browser_session_id: sessionId,
    tab_id: z.string().min(1).max(256).optional(),
    full_page: z.boolean().optional(),
    max_bytes: z.number().int().min(1024).max(5000000).optional(),
    result_mode: z.enum(["file", "inline"]).optional(),
    output_path: z.string().min(1).max(32768).optional(),
    overwrite: z.boolean().optional(),
  }, async (args) => call(() => layer.screenshot(args)));
}
