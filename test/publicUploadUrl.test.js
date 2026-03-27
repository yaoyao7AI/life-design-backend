import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeUploadsUrl,
  resolvePublicUploadUrl,
} from "../src/utils/publicUploadUrl.js";

function mockReq(protocol, host) {
  return {
    protocol,
    get(name) {
      if (name === "host") return host;
      return undefined;
    },
  };
}

test("设置 PUBLIC_ASSET_BASE_URL 时返回 HTTPS 正式域名（忽略 req）", () => {
  const prev = process.env.PUBLIC_ASSET_BASE_URL;
  process.env.PUBLIC_ASSET_BASE_URL = "https://api.life-design.me";
  try {
    const url = resolvePublicUploadUrl(
      "7/12/cover.jpg",
      mockReq("http", "123.56.17.118")
    );
    assert.equal(url, "https://api.life-design.me/uploads/7/12/cover.jpg");
  } finally {
    if (prev === undefined) delete process.env.PUBLIC_ASSET_BASE_URL;
    else process.env.PUBLIC_ASSET_BASE_URL = prev;
  }
});

test("PUBLIC_ASSET_BASE_URL 带末尾斜杠时仍拼出单斜杠路径", () => {
  const prev = process.env.PUBLIC_ASSET_BASE_URL;
  process.env.PUBLIC_ASSET_BASE_URL = "https://api.life-design.me/";
  try {
    const url = resolvePublicUploadUrl("1/a.png", mockReq("http", "x"));
    assert.equal(url, "https://api.life-design.me/uploads/1/a.png");
  } finally {
    if (prev === undefined) delete process.env.PUBLIC_ASSET_BASE_URL;
    else process.env.PUBLIC_ASSET_BASE_URL = prev;
  }
});

test("未设置 PUBLIC_ASSET_BASE_URL 时回退到 req.protocol 与 Host", () => {
  const prev = process.env.PUBLIC_ASSET_BASE_URL;
  delete process.env.PUBLIC_ASSET_BASE_URL;
  try {
    const url = resolvePublicUploadUrl("u/b.jpg", mockReq("http", "127.0.0.1:3000"));
    assert.equal(url, "http://127.0.0.1:3000/uploads/u/b.jpg");
  } finally {
    if (prev !== undefined) process.env.PUBLIC_ASSET_BASE_URL = prev;
  }
});

test("normalizeUploadsUrl 可将历史 http 上传地址规范为正式 HTTPS 域名", () => {
  const prev = process.env.PUBLIC_ASSET_BASE_URL;
  process.env.PUBLIC_ASSET_BASE_URL = "https://api.life-design.me";
  try {
    assert.equal(
      normalizeUploadsUrl("http://123.56.17.118:3000/uploads/1/2/cover.jpg"),
      "https://api.life-design.me/uploads/1/2/cover.jpg"
    );
  } finally {
    if (prev === undefined) delete process.env.PUBLIC_ASSET_BASE_URL;
    else process.env.PUBLIC_ASSET_BASE_URL = prev;
  }
});

test("normalizeUploadsUrl 可将相对 uploads 路径规范为正式 HTTPS 域名", () => {
  const prev = process.env.PUBLIC_ASSET_BASE_URL;
  process.env.PUBLIC_ASSET_BASE_URL = "https://api.life-design.me";
  try {
    assert.equal(
      normalizeUploadsUrl("/uploads/1/3/item.png"),
      "https://api.life-design.me/uploads/1/3/item.png"
    );
    assert.equal(
      normalizeUploadsUrl("uploads/1/3/item.png"),
      "https://api.life-design.me/uploads/1/3/item.png"
    );
  } finally {
    if (prev === undefined) delete process.env.PUBLIC_ASSET_BASE_URL;
    else process.env.PUBLIC_ASSET_BASE_URL = prev;
  }
});
