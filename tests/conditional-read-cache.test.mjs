import test from "node:test";
import assert from "node:assert/strict";
import {
  createConditionalReadCache,
  sha256Text,
} from "../lib/conditional-read-cache.mjs";

test("sha256Text returns a stable SHA-256 digest", () => {
  assert.equal(
    sha256Text("alpha"),
    "8ed3f6ad685b959ead7022518e1af76cd816f8e8ec7ccdda1ed4018e8f2223f8"
  );
});

test("conditional read cache suppresses unchanged fresh results", async () => {
  const cache = createConditionalReadCache();
  let executions = 0;

  const first = await cache.run({
    cacheKey: "status",
    execute: async () => {
      executions += 1;
      return "alpha";
    },
  });

  assert.equal(first.notModified, false);
  assert.equal(first.cacheHit, false);
  assert.equal(first.executionSkipped, false);
  assert.equal(first.resultText, "alpha");
  assert.equal(executions, 1);

  const second = await cache.run({
    cacheKey: "status",
    knownDigest: first.resultDigestSha256,
    cacheMaxAgeMs: 60000,
    execute: async () => {
      executions += 1;
      return "should-not-run";
    },
  });

  assert.equal(second.notModified, true);
  assert.equal(second.resultSuppressed, true);
  assert.equal(second.cacheHit, true);
  assert.equal(second.executionSkipped, true);
  assert.equal(second.resultText, "");
  assert.equal(executions, 1);
});

test("zero TTL revalidates safely and still suppresses unchanged content", async () => {
  const cache = createConditionalReadCache();
  let executions = 0;

  const first = await cache.run({
    cacheKey: "status",
    execute: async () => {
      executions += 1;
      return "alpha";
    },
  });

  const second = await cache.run({
    cacheKey: "status",
    knownDigest: first.resultDigestSha256,
    cacheMaxAgeMs: 0,
    execute: async () => {
      executions += 1;
      return "alpha";
    },
  });

  assert.equal(second.notModified, true);
  assert.equal(second.cacheHit, false);
  assert.equal(second.executionSkipped, false);
  assert.equal(second.resultText, "");
  assert.equal(executions, 2);
});

test("changed content is returned and refreshes digest metadata", async () => {
  const cache = createConditionalReadCache();

  const first = await cache.run({
    cacheKey: "status",
    execute: async () => "alpha",
  });

  const changed = await cache.run({
    cacheKey: "status",
    knownDigest: first.resultDigestSha256,
    cacheMaxAgeMs: 0,
    execute: async () => "beta",
  });

  assert.equal(changed.notModified, false);
  assert.equal(changed.cacheHit, false);
  assert.equal(changed.executionSkipped, false);
  assert.equal(changed.resultText, "beta");
  assert.notEqual(changed.resultDigestSha256, first.resultDigestSha256);
});

test("errors are not cached", async () => {
  const cache = createConditionalReadCache();
  let executions = 0;

  await assert.rejects(
    cache.run({
      cacheKey: "unstable",
      execute: async () => {
        executions += 1;
        throw new Error("read failed");
      },
    }),
    /read failed/
  );

  const recovered = await cache.run({
    cacheKey: "unstable",
    execute: async () => {
      executions += 1;
      return "recovered";
    },
  });

  assert.equal(executions, 2);
  assert.equal(recovered.resultText, "recovered");
  assert.equal(cache.snapshot().entries, 1);
});

test("cache retains metadata only and evicts beyond its bound", async () => {
  const cache = createConditionalReadCache({ maxEntries: 2, maxCacheAgeMs: 1000 });

  await cache.run({
    cacheKey: "one",
    execute: async () => "secret-ish-read-result",
  });
  await cache.run({
    cacheKey: "two",
    execute: async () => "second-result",
  });
  await cache.run({
    cacheKey: "three",
    execute: async () => "third-result",
  });

  assert.deepEqual(cache.snapshot(), {
    digestAlgorithm: "sha256",
    contentRetained: false,
    maxEntries: 2,
    maxCacheAgeMs: 1000,
    entries: 2,
  });
});
