import test from "node:test";
import assert from "node:assert/strict";
import {
  isLikelyPdfUpload,
  isPdfMimeType,
  normalizeTodoAttachmentsInput,
  normalizeTodoAttachmentType,
} from "../src/utils/todoAttachmentUtils.js";

test("normalizeTodoAttachmentType 支持 pdf 别名", () => {
  assert.equal(normalizeTodoAttachmentType("pdf"), "file");
  assert.equal(normalizeTodoAttachmentType("file"), "file");
  assert.equal(normalizeTodoAttachmentType("image"), "image");
  assert.equal(normalizeTodoAttachmentType("video"), "video");
  assert.equal(normalizeTodoAttachmentType("doc"), null);
});

test("isPdfMimeType 仅接受 application/pdf", () => {
  assert.equal(isPdfMimeType("application/pdf"), true);
  assert.equal(isPdfMimeType("APPLICATION/PDF"), true);
  assert.equal(isPdfMimeType("image/png"), false);
});

test("isLikelyPdfUpload 兼容 octet-stream + .pdf 文件名", () => {
  assert.equal(
    isLikelyPdfUpload({
      mimetype: "application/octet-stream",
      originalname: "a.pdf",
    }),
    true
  );
  assert.equal(
    isLikelyPdfUpload({
      mimetype: "",
      originalname: "a.pdf",
    }),
    true
  );
  assert.equal(
    isLikelyPdfUpload({
      mimetype: "application/octet-stream",
      originalname: "a.png",
    }),
    false
  );
  assert.equal(
    isLikelyPdfUpload({
      mimetype: "application/x-pdf",
      originalname: "x",
    }),
    true
  );
  assert.equal(
    isLikelyPdfUpload({
      mimetype: "application/octet-stream",
      originalname: "  report.PDF  ",
    }),
    true
  );
  assert.equal(
    isLikelyPdfUpload({
      mimetype: "application/json",
      originalname: "report.pdf",
    }),
    true
  );
  assert.equal(
    isLikelyPdfUpload({
      mimetype: "image/png",
      originalname: "report.pdf",
    }),
    false
  );
});

test("normalizeTodoAttachmentsInput 允许单个 PDF 文件附件", () => {
  const result = normalizeTodoAttachmentsInput([
    {
      type: "pdf",
      url: "https://api.life-design.me/uploads/3/todos/demo/report.pdf",
      fileName: "report.pdf",
    },
  ]);

  assert.equal(result.provided, true);
  assert.deepEqual(result.items, [
    {
      id: null,
      type: "file",
      url: "https://api.life-design.me/uploads/3/todos/demo/report.pdf",
      file_name: "report.pdf",
    },
  ]);
});

test("normalizeTodoAttachmentsInput 拒绝多个文件附件", () => {
  assert.throws(
    () =>
      normalizeTodoAttachmentsInput([
        { type: "file", url: "https://x/a.pdf", file_name: "a.pdf" },
        { type: "pdf", url: "https://x/b.pdf", file_name: "b.pdf" },
      ]),
    /最多只能上传 1 个文件附件/
  );
});

test("normalizeTodoAttachmentsInput 拒绝非 PDF 文件附件", () => {
  assert.throws(
    () =>
      normalizeTodoAttachmentsInput([
        { type: "file", url: "https://x/a.docx", file_name: "a.docx" },
      ]),
    /文件附件仅支持 PDF/
  );
});
