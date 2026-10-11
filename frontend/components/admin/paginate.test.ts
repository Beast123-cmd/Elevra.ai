import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchAllRows } from "./paginate.ts";

const source = (n: number) => async (from: number, to: number) => ({
  data: Array.from({ length: Math.max(0, Math.min(to, n - 1) - from + 1) }, (_, i) => from + i),
  error: null,
});

test("pages past the 1000-row API cap and returns everything once", async () => {
  const rows = await fetchAllRows(source(2500));
  assert.equal(rows.length, 2500);
  assert.equal(new Set(rows).size, 2500);
});

test("exact multiple of the page size does not loop forever", async () => {
  let calls = 0;
  const counting = async (from: number, to: number) => {
    calls += 1;
    return source(2000)(from, to);
  };
  const rows = await fetchAllRows(counting);
  assert.equal(rows.length, 2000);
  assert.equal(calls, 3);
});

test("empty table returns an empty list", async () => {
  assert.deepEqual(await fetchAllRows(source(0)), []);
});

test("an error on any page is thrown, not swallowed", async () => {
  let page = 0;
  const flaky = async (from: number, to: number) =>
    ++page === 2 ? { data: null, error: { message: "boom" } } : source(5000)(from, to);
  await assert.rejects(() => fetchAllRows(flaky), /boom/);
});
