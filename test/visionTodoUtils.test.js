import test from "node:test";
import assert from "node:assert/strict";
import {
  parseMonthRange,
  currentMonthRange,
  toDateOrNull,
  normalizeTimeZone,
  timeZoneFromRequest,
  monthRangeFromVisionRequest,
} from "../src/utils/visionTodoUtils.js";

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

test("parseMonthRange uses local calendar month when IANA tz is set", () => {
  const range = parseMonthRange("2026-03", "Asia/Shanghai");
  assert.ok(range);
  assert.equal(range.start.toISOString(), "2026-02-28T16:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-03-31T16:00:00.000Z");
});

test("normalizeTimeZone rejects unknown zones", () => {
  assert.equal(normalizeTimeZone("Not/A_Real_Zone"), null);
  assert.equal(normalizeTimeZone("Asia/Shanghai"), "Asia/Shanghai");
});

test("timeZoneFromRequest reads query and headers", () => {
  assert.equal(
    timeZoneFromRequest({
      query: { tz: "Asia/Shanghai" },
      headers: {},
    }),
    "Asia/Shanghai"
  );
  assert.equal(
    timeZoneFromRequest({
      query: {},
      headers: { "x-time-zone": "Asia/Tokyo" },
    }),
    "Asia/Tokyo"
  );
});

test("monthRangeFromVisionRequest uses tz from query when month is set", () => {
  const range = monthRangeFromVisionRequest({
    query: { month: "2026-03", tz: "Asia/Shanghai" },
    headers: {},
  });
  assert.equal(range.start.toISOString(), "2026-02-28T16:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-03-31T16:00:00.000Z");
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
