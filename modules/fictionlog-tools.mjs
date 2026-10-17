import { z } from "zod";
import { createConditionalReadCache, sha256Text } from "../lib/conditional-read-cache.mjs";

const sessionId = z.string().min(1).max(128);
const url = z.string().url().max(8192);
const knownDigest = z.string().regex(/^[a-f0-9]{64}$/i).optional();
const cacheMaxAgeMs = z.number().int().min(0).max(300000).optional();
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

async function callAndInvalidate(cache, fn) {
  try { return textResult(await fn()); }
  catch (error) { return textResult(error?.message || String(error), true); }
  finally { cache.clear(); }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function cacheKey(kind, args) {
  return kind + ":" + sha256Text(JSON.stringify(canonicalize(args)));
}

function conditionalMetadata(result) {
  return {
    result_digest_sha256: result.resultDigestSha256,
    result_bytes: result.resultBytes,
    result_chars: result.resultChars,
    returned_chars: result.returnedChars,
    not_modified: result.notModified,
    result_suppressed: result.resultSuppressed,
    cache_hit: result.cacheHit,
    execution_skipped: result.executionSkipped,
    cache_age_ms: result.cacheAgeMs,
    content_retained: result.contentRetained,
  };
}

async function conditionalCall(cache, kind, readArgs, knownDigestValue, cacheMaxAgeValue, fn) {
  try {
    let payload;
    const result = await cache.run({
      cacheKey: cacheKey(kind, readArgs),
      knownDigest: knownDigestValue,
      cacheMaxAgeMs: cacheMaxAgeValue ?? 0,
      execute: async () => {
        payload = await fn();
        return JSON.stringify(payload, null, 2);
      },
    });

    const metadata = conditionalMetadata(result);
    return result.notModified
      ? textResult(metadata)
      : textResult({ ...payload, ...metadata });
  } catch (error) {
    return textResult(error?.message || String(error), true);
  }
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
  const readCache = createConditionalReadCache({ maxEntries: 128, maxCacheAgeMs: 300000 });

  server.tool("browser_start", "Start the dedicated managed Firefox session for Fictionlog.", {
    browser: z.literal("firefox").optional(),
    url: url.optional(),
    headless: z.boolean().optional(),
  }, async ({ browser = "firefox", url: startUrl, headless = false }) =>
    callAndInvalidate(readCache, () => layer.start({ browser, url: startUrl, headless, options: {} })));

  server.tool("browser_stop", "Stop a FictionlogWriter managed browser session.", {
    browser_session_id: sessionId,
    close_remote_session: z.boolean().optional(),
  }, async (args) => callAndInvalidate(readCache, () => layer.stop(args)));

  server.tool("browser_tabs", "List tabs in a FictionlogWriter managed browser session. Supports SHA-256 conditional reads and short digest-only TTL reuse.", {
    browser_session_id: sessionId,
    known_digest: knownDigest,
    cache_max_age_ms: cacheMaxAgeMs,
  }, async ({ known_digest, cache_max_age_ms, ...args }) =>
    conditionalCall(
      readCache,
      "browser_tabs:v1",
      args,
      known_digest,
      cache_max_age_ms,
      () => layer.tabs(args)
    ));

  server.tool("browser_navigate", "Navigate the managed browser. Only Fictionlog HTTPS URLs are allowed.", {
    browser_session_id: sessionId,
    url,
    tab_id: z.string().min(1).max(256).optional(),
    wait: z.enum(["none", "interactive", "complete"]).optional(),
    timeout_ms: z.number().int().min(100).max(120000).optional(),
  }, async (args) => callAndInvalidate(readCache, () => layer.navigate(args)));

  server.tool("browser_snapshot", "Read a bounded DOM snapshot from the Fictionlog browser. Supports SHA-256 conditional reads and short digest-only TTL reuse.", {
    browser_session_id: sessionId,
    tab_id: z.string().min(1).max(256).optional(),
    target: target.optional(),
    max_chars: z.number().int().min(1000).max(250000).optional(),
    mode: z.enum(["dom", "text"]).optional(),
    include_state: z.boolean().optional(),
    known_digest: knownDigest,
    cache_max_age_ms: cacheMaxAgeMs,
  }, async ({ known_digest, cache_max_age_ms, ...args }) =>
    conditionalCall(
      readCache,
      "browser_snapshot:v1",
      args,
      known_digest,
      cache_max_age_ms,
      () => layer.snapshot(args)
    ));

  server.tool("browser_click", "Click an element in the Fictionlog browser.", {
    browser_session_id: sessionId,
    tab_id: z.string().min(1).max(256).optional(),
    target,
    button: z.enum(["left", "middle", "right"]).optional(),
    click_count: z.number().int().min(1).max(3).optional(),
  }, async (args) => callAndInvalidate(readCache, () => layer.click(args)));

  server.tool("browser_type", "Type text into an element in the Fictionlog browser.", {
    browser_session_id: sessionId,
    tab_id: z.string().min(1).max(256).optional(),
    target,
    text: z.string().max(500000),
    clear: z.boolean().optional(),
  }, async (args) => callAndInvalidate(readCache, () => layer.type(args)));

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
