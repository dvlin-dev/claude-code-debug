import * as zlib from "node:zlib";
import { decompress as zstdFallbackDecompress } from "fzstd";
import type { CapturedBody } from "../../shared/contracts";

function normalizeEncoding(value: string | null): string {
  return value?.trim().toLowerCase() ?? "identity";
}

function extractCharset(contentType: string | null): string {
  if (!contentType) {
    return "utf-8";
  }

  const match = /charset=([^;]+)/i.exec(contentType);
  return match?.[1]?.trim() || "utf-8";
}

export function getCapturedBodyBuffer(body: CapturedBody | null): Buffer | null {
  if (!body) {
    return null;
  }

  const bytes = Buffer.from(body.bytes);
  switch (normalizeEncoding(body.contentEncoding)) {
    case "":
    case "identity":
      return bytes;
    case "gzip":
      return zlib.gunzipSync(bytes);
    case "deflate":
      return zlib.inflateSync(bytes);
    case "br":
      return zlib.brotliDecompressSync(bytes);
    case "zstd":
      if (typeof zlib.zstdDecompressSync === "function") {
        return zlib.zstdDecompressSync(bytes);
      }
      return Buffer.from(zstdFallbackDecompress(bytes));
    default:
      return bytes;
  }
}

export function getCapturedBodyText(body: CapturedBody | null): string | null {
  if (!body) {
    return null;
  }

  try {
    const buffer = getCapturedBodyBuffer(body);
    if (!buffer) {
      return null;
    }

    const charset = extractCharset(body.contentType);
    try {
      return new TextDecoder(charset).decode(buffer);
    } catch {
      console.warn(`[body-codec] Unsupported charset "${charset}", falling back to utf-8`);
      return new TextDecoder("utf-8").decode(buffer);
    }
  } catch (error) {
    console.warn("[body-codec] Failed to decode body:", error);
    return null;
  }
}
