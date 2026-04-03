import test from "node:test";
import assert from "node:assert/strict";
import { parseCompletedFromTodo } from "../src/utils/syncUtils.js";

test("parseCompletedFromTodo: completed 优先", () => {
  assert.equal(parseCompletedFromTodo({ completed: false, status: "done" }), false);
  assert.equal(parseCompletedFromTodo({ completed: true, status: "pending" }), true);
});

test("parseCompletedFromTodo: done / status 回退", () => {
  assert.equal(parseCompletedFromTodo({ done: true }), true);
  assert.equal(parseCompletedFromTodo({ status: "done" }), true);
  assert.equal(parseCompletedFromTodo({ status: "pending" }), false);
  assert.equal(parseCompletedFromTodo({ status: "open" }), false);
});

test("parseCompletedFromTodo: 缺省为 false", () => {
  assert.equal(parseCompletedFromTodo({}), false);
  assert.equal(parseCompletedFromTodo(null), false);
});
