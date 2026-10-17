import test from "node:test";
import assert from "node:assert/strict";
import { assertFictionlogUrl } from "../modules/fictionlog-policy.mjs";

test("allows Fictionlog HTTPS URLs", () => {
  assert.equal(assertFictionlogUrl("https://fictionlog.co/"), "https://fictionlog.co/");
  assert.equal(assertFictionlogUrl("https://www.fictionlog.co/p/abc"), "https://www.fictionlog.co/p/abc");
});

test("blocks non-Fictionlog hosts", () => {
  assert.throws(() => assertFictionlogUrl("https://example.com/"), /FICTIONLOG_DOMAIN_BLOCKED/);
});

test("blocks non-HTTPS Fictionlog URLs", () => {
  assert.throws(() => assertFictionlogUrl("http://fictionlog.co/"), /FICTIONLOG_DOMAIN_BLOCKED/);
});
