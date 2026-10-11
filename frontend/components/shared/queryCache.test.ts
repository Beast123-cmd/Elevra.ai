import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { clearQueryCache, FRESH_MS, MAX_AGE_MS, readCache, setCacheOwner, writeCache } from "./queryCache.ts";

beforeEach(() => {
  clearQueryCache();
  setCacheOwner(null);
});

test("an empty cache returns nothing", () => {
  assert.equal(readCache("admin:overview", 1000), null);
});

test("a recent entry is returned as fresh", () => {
  writeCache("k", { rows: 3 }, 1000);
  assert.deepEqual(readCache("k", 1000 + FRESH_MS - 1), { value: { rows: 3 }, fresh: true });
});

test("an older entry is still shown but marked stale, so the caller refetches in the background", () => {
  writeCache("k", "v", 1000);
  assert.deepEqual(readCache("k", 1000 + FRESH_MS + 1), { value: "v", fresh: false });
  assert.deepEqual(readCache("k", 1000 + MAX_AGE_MS - 1), { value: "v", fresh: false });
});

test("a very old entry is ignored and dropped", () => {
  writeCache("k", "v", 1000);
  assert.equal(readCache("k", 1000 + MAX_AGE_MS + 1), null);
  assert.equal(readCache("k", 1000), null, "once dropped it stays dropped");
});

test("writing again replaces the value and restarts the clock", () => {
  writeCache("k", "old", 1000);
  writeCache("k", "new", 5000);
  assert.deepEqual(readCache("k", 5000 + FRESH_MS - 1), { value: "new", fresh: true });
});

test("keys are independent, and clearing removes everything", () => {
  writeCache("a", 1, 1000);
  writeCache("b", 2, 1000);
  assert.equal(readCache("a", 1000)?.value, 1);
  clearQueryCache();
  assert.equal(readCache("a", 1000), null);
  assert.equal(readCache("b", 1000), null);
});

test("signing in as a different person empties the cache so nobody sees another user's data", () => {
  setCacheOwner("user-a");
  writeCache("k", "a's data", 1000);
  setCacheOwner("user-a");
  assert.equal(readCache("k", 1000)?.value, "a's data", "the same user keeps their cache (e.g. after a token refresh)");
  setCacheOwner("user-b");
  assert.equal(readCache("k", 1000), null);
});

test("signing out (owner becomes null) empties the cache", () => {
  setCacheOwner("user-a");
  writeCache("k", "v", 1000);
  setCacheOwner(null);
  assert.equal(readCache("k", 1000), null);
});
