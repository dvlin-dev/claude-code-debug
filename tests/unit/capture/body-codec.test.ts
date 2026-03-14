import { describe, expect, it } from "vitest";
import * as zlib from "node:zlib";
import {
  getCapturedBodyBuffer,
  getCapturedBodyText,
} from "../../../src/main/capture/body-codec";
import type { CapturedBody } from "../../../src/shared/contracts";

function makeBody(
  bytes: Buffer,
  contentType: string | null = "application/json",
  contentEncoding: string | null = null,
): CapturedBody {
  return { bytes, contentType, contentEncoding };
}

describe("getCapturedBodyBuffer", () => {
  it("returns null for null body", () => {
    expect(getCapturedBodyBuffer(null)).toBeNull();
  });

  it("returns raw bytes for identity encoding", () => {
    const data = Buffer.from("hello");
    expect(getCapturedBodyBuffer(makeBody(data))).toEqual(data);
  });

  it("returns raw bytes for empty encoding string", () => {
    const data = Buffer.from("hello");
    expect(getCapturedBodyBuffer(makeBody(data, null, ""))).toEqual(data);
  });

  it("decompresses gzip", () => {
    const original = "gzip test data";
    const compressed = zlib.gzipSync(Buffer.from(original));
    const result = getCapturedBodyBuffer(makeBody(compressed, null, "gzip"));
    expect(result?.toString("utf-8")).toBe(original);
  });

  it("decompresses deflate", () => {
    const original = "deflate test data";
    const compressed = zlib.deflateSync(Buffer.from(original));
    const result = getCapturedBodyBuffer(makeBody(compressed, null, "deflate"));
    expect(result?.toString("utf-8")).toBe(original);
  });

  it("decompresses brotli", () => {
    const original = "brotli test data";
    const compressed = zlib.brotliCompressSync(Buffer.from(original));
    const result = getCapturedBodyBuffer(makeBody(compressed, null, "br"));
    expect(result?.toString("utf-8")).toBe(original);
  });

  it("normalizes encoding case (GZIP → gzip)", () => {
    const original = "case test";
    const compressed = zlib.gzipSync(Buffer.from(original));
    const result = getCapturedBodyBuffer(makeBody(compressed, null, " GZIP "));
    expect(result?.toString("utf-8")).toBe(original);
  });

  it("returns raw bytes for unknown encoding", () => {
    const data = Buffer.from("passthrough");
    expect(getCapturedBodyBuffer(makeBody(data, null, "unknown-enc"))).toEqual(data);
  });
});

describe("getCapturedBodyText", () => {
  it("returns null for null body", () => {
    expect(getCapturedBodyText(null)).toBeNull();
  });

  it("decodes utf-8 by default", () => {
    const text = "hello world 你好";
    const body = makeBody(Buffer.from(text, "utf-8"));
    expect(getCapturedBodyText(body)).toBe(text);
  });

  it("respects charset in content-type", () => {
    const text = "ascii text";
    const body = makeBody(
      Buffer.from(text, "ascii"),
      "text/plain; charset=ascii",
    );
    expect(getCapturedBodyText(body)).toBe(text);
  });

  it("falls back to utf-8 for invalid charset", () => {
    const text = "fallback test";
    const body = makeBody(
      Buffer.from(text, "utf-8"),
      "text/plain; charset=invalid-charset-xyz",
    );
    expect(getCapturedBodyText(body)).toBe(text);
  });

  it("returns null for corrupted gzip data", () => {
    const body = makeBody(Buffer.from([0x1f, 0x8b, 0x00, 0xff]), null, "gzip");
    expect(getCapturedBodyText(body)).toBeNull();
  });

  it("handles decompression + charset together", () => {
    const text = "compressed and decoded";
    const compressed = zlib.gzipSync(Buffer.from(text, "utf-8"));
    const body = makeBody(compressed, "application/json; charset=utf-8", "gzip");
    expect(getCapturedBodyText(body)).toBe(text);
  });
});
