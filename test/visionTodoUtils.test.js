import test from "node:test";
import assert from "node:assert/strict";
import { parseMonthRange, currentMonthRange, toDateOrNull } from "../src/utils/visionTodoUtils.js";

test("parseMonthRange returns UTC month boundaries", () => {
  const range = parseMonthRange("2026-03");
  assert.ok(range);
  assert.equal(range.start.toISOString(), "2026-03-01T00:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-04-01T00:00:00.000Z");
});

test("parseMonthRange rejects invalid formats", () => {
  assert.equal(parseMonthRange("2026-13"), null);
  assert.equal(parseMonthRange("2026-00"), null);
  assert.equal(parseMonthRange("202603"), null);
  assert.equal(parseMonthRange(""), null);
});

test("toDateOrNull returns null for invalid values", () => {
  assert.equal(toDateOrNull(undefined), null);
  assert.equal(toDateOrNull(""), null);
  assert.equal(toDateOrNull("not-a-date"), null);
});

test("currentMonthRange returns valid, ordered boundaries", () => {
  const { start, end } = currentMonthRange();
  assert.ok(start instanceof Date);
  assert.ok(end instanceof Date);
  assert.ok(end.getTime() > start.getTime());
  assert.equal(start.getUTCDate(), 1);
  assert.equal(start.getUTCHours(), 0);
  assert.equal(start.getUTCMinutes(), 0);
  assert.equal(start.getUTCSeconds(), 0);
});
