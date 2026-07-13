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

test("image content URL is normalized in response when PUBLIC_ASSET_BASE_URL is set", () => {
  const prev = process.env.PUBLIC_ASSET_BASE_URL;
  process.env.PUBLIC_ASSET_BASE_URL = "https://api.life-design.me";
  try {
    const output = normalizeElementForResponse({
      type: "image",
      content: "http://123.56.17.118:3000/uploads/2/5/cover.jpg",
      width: 100,
      height: 100,
    });
    assert.equal(
      output.content,
      "https://api.life-design.me/uploads/2/5/cover.jpg"
    );
  } finally {
    if (prev === undefined) delete process.env.PUBLIC_ASSET_BASE_URL;
    else process.env.PUBLIC_ASSET_BASE_URL = prev;
  }
});
