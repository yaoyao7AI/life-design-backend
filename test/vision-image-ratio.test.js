import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeElementForPersistence,
  normalizeElementForResponse,
} from "../src/routes/vision-element-normalizers.js";

test("image width/height are preserved in persistence normalization", () => {
  const input = {
    type: "image",
    content: "https://example.com/a.png",
    width: 333.5,
    height: 111.25,
  };
  const output = normalizeElementForPersistence(input);
  assert.equal(output.width, 333.5);
  assert.equal(output.height, 111.25);
});

test("image width/height are preserved in response normalization", () => {
  const output = normalizeElementForResponse({
    type: "image",
    width: 333.5,
    height: 111.25,
  });
  assert.equal(output.width, 333.5);
  assert.equal(output.height, 111.25);
});
