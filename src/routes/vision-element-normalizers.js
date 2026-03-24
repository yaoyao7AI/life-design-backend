function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function toOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toNumberWithDefault(value, defaultValue) {
  const num = toOptionalNumber(value);
  return num ?? defaultValue;
}

function toOptionalInt(value) {
  if (value === undefined || value === null || value === "") return null;
  const num = Number.parseInt(String(value), 10);
  return Number.isFinite(num) ? num : null;
}

function normalizeElementForPersistence(element) {
  const raw = element && typeof element === "object" ? element : {};
  const type = typeof raw.type === "string" && raw.type ? raw.type : "text";

  return {
    type,
    content: hasOwn(raw, "content") ? raw.content : null,
    x: toNumberWithDefault(raw.x, 0),
    y: toNumberWithDefault(raw.y, 0),
    width: toOptionalNumber(raw.width),
    height: toOptionalNumber(raw.height),
    rotation: toNumberWithDefault(raw.rotation, 0),
    font_size: hasOwn(raw, "font_size")
      ? toOptionalInt(raw.font_size)
      : toOptionalInt(raw.fontSize),
    color: hasOwn(raw, "color") ? raw.color ?? null : null,
    scale: toOptionalNumber(raw.scale),
  };
}

function normalizeElementForResponse(element) {
  const output = {
    ...element,
    x: toNumberWithDefault(element?.x, 0),
    y: toNumberWithDefault(element?.y, 0),
    width: toOptionalNumber(element?.width),
    height: toOptionalNumber(element?.height),
    rotation: toNumberWithDefault(element?.rotation, 0),
  };

  if (hasOwn(output, "scale")) {
    output.scale = toOptionalNumber(output.scale);
  }

  return output;
}

export { normalizeElementForPersistence, normalizeElementForResponse };
