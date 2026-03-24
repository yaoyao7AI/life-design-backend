import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeElementForPersistence,
  normalizeElementForResponse,
} from "../src/routes/vision-element-normalizers.js";

test("图片元素应保留 x/y/width/height 的 number 精度与 0 值", () => {
  const normalized = normalizeElementForPersistence({
    type: "image",
    x: "120.125",
    y: -88.5,
    width: 0,
    height: "300.3333",
    rotation: "0",
  });

  assert.equal(normalized.x, 120.125);
  assert.equal(normalized.y, -88.5);
  assert.equal(normalized.width, 0);
  assert.equal(normalized.height, 300.3333);
  assert.equal(normalized.rotation, 0);
});

test("仅传 scale 的历史元素可兼容处理，width/height 不会被默认值污染", () => {
  const normalized = normalizeElementForPersistence({
    type: "image",
    x: 12,
    y: 24,
    scale: "1.75",
  });

  assert.equal(normalized.width, null);
  assert.equal(normalized.height, null);
  assert.equal(normalized.scale, 1.75);
});

test("同一元素保存两次后，x/y/width/height 保持稳定", () => {
  const firstSave = normalizeElementForPersistence({
    type: "image",
    x: 10.11,
    y: 20.22,
    width: 333.444,
    height: 222.111,
    scale: 1.2,
  });

  const firstRead = normalizeElementForResponse(firstSave);
  const secondSave = normalizeElementForPersistence(firstRead);
  const secondRead = normalizeElementForResponse(secondSave);

  assert.deepEqual(
    {
      x: secondRead.x,
      y: secondRead.y,
      width: secondRead.width,
      height: secondRead.height,
    },
    {
      x: firstSave.x,
      y: firstSave.y,
      width: firstSave.width,
      height: firstSave.height,
    }
  );
});
