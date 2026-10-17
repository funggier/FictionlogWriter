import { createHash } from "node:crypto";

const SHA256_RE = /^[a-f0-9]{64}$/i;

function assertIntegerInRange(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer between ${min} and ${max}.`);
  }
}

export function sha256Text(text) {
  if (typeof text !== "string") {
    throw new TypeError("sha256Text expects a string.");
  }
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function createConditionalReadCache({
  maxEntries = 256,
  maxCacheAgeMs = 300000,
} = {}) {
  assertIntegerInRange(maxEntries, "maxEntries", 1, 10000);
  assertIntegerInRange(maxCacheAgeMs, "maxCacheAgeMs", 0, 3600000);

  const digestCache = new Map();

  function normalizeKnownDigest(value) {
    if (value == null || value === "") return null;
    if (typeof value !== "string" || !SHA256_RE.test(value)) {
      throw new TypeError("knownDigest must be a 64-character SHA-256 hex digest.");
    }
    return value.toLowerCase();
  }

  function normalizeCacheAge(value) {
    if (value == null) return 0;
    assertIntegerInRange(value, "cacheMaxAgeMs", 0, maxCacheAgeMs);
    return value;
  }

  function readFreshMetadata(cacheKey, cacheMaxAgeMs, nowMs) {
    const entry = digestCache.get(cacheKey);
    if (!entry) return null;

    const ageMs = Math.max(0, nowMs - entry.checkedAtMs);
    if (cacheMaxAgeMs <= 0 || ageMs > cacheMaxAgeMs) {
      return null;
    }

    digestCache.delete(cacheKey);
    digestCache.set(cacheKey, entry);
    return { ...entry, ageMs };
  }

  function writeMetadata(cacheKey, metadata) {
    digestCache.delete(cacheKey);
    digestCache.set(cacheKey, metadata);

    while (digestCache.size > maxEntries) {
      const oldestKey = digestCache.keys().next().value;
      digestCache.delete(oldestKey);
    }
  }

  async function run({
    cacheKey,
    knownDigest = null,
    cacheMaxAgeMs = 0,
    execute,
  }) {
    if (typeof cacheKey !== "string" || cacheKey.length === 0) {
      throw new TypeError("cacheKey must be a non-empty string.");
    }
    if (typeof execute !== "function") {
      throw new TypeError("execute must be a function.");
    }

    const normalizedKnownDigest = normalizeKnownDigest(knownDigest);
    const normalizedCacheAgeMs = normalizeCacheAge(cacheMaxAgeMs);
    const nowMs = Date.now();

    if (normalizedKnownDigest && normalizedCacheAgeMs > 0) {
      const cached = readFreshMetadata(cacheKey, normalizedCacheAgeMs, nowMs);
      if (cached && cached.resultDigestSha256 === normalizedKnownDigest) {
        return {
          resultText: "",
          resultDigestSha256: cached.resultDigestSha256,
          resultBytes: cached.resultBytes,
          resultChars: cached.resultChars,
          returnedChars: 0,
          notModified: true,
          resultSuppressed: true,
          cacheHit: true,
          executionSkipped: true,
          cacheAgeMs: cached.ageMs,
          contentRetained: false,
        };
      }
    }

    const resultText = await execute();
    if (typeof resultText !== "string") {
      throw new TypeError("Conditional read execute() must return a string.");
    }

    const resultDigestSha256 = sha256Text(resultText);
    const resultBytes = Buffer.byteLength(resultText, "utf8");
    const resultChars = resultText.length;

    writeMetadata(cacheKey, {
      resultDigestSha256,
      resultBytes,
      resultChars,
      checkedAtMs: Date.now(),
    });

    const notModified = Boolean(
      normalizedKnownDigest && normalizedKnownDigest === resultDigestSha256
    );

    return {
      resultText: notModified ? "" : resultText,
      resultDigestSha256,
      resultBytes,
      resultChars,
      returnedChars: notModified ? 0 : resultChars,
      notModified,
      resultSuppressed: notModified,
      cacheHit: false,
      executionSkipped: false,
      cacheAgeMs: null,
      contentRetained: false,
    };
  }

  function clear() {
    digestCache.clear();
  }

  function snapshot() {
    return {
      digestAlgorithm: "sha256",
      contentRetained: false,
      maxEntries,
      maxCacheAgeMs,
      entries: digestCache.size,
    };
  }

  return {
    run,
    clear,
    snapshot,
  };
}
