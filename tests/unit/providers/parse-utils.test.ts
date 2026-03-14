import { describe, expect, it } from "vitest";
import {
  parseJson,
  getString,
  parseMaybeJson,
} from "../../../src/main/providers/protocol-adapters/shared/parse-utils";

describe("parseJson", () => {
  it("returns null for null input", () => {
    expect(parseJson(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseJson("")).toBeNull();
  });

  it("parses valid JSON object", () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("returns null for JSON array (not object)", () => {
    expect(parseJson("[1,2,3]")).toBeNull();
  });

  it("returns null for JSON primitive", () => {
    expect(parseJson('"hello"')).toBeNull();
    expect(parseJson("42")).toBeNull();
    expect(parseJson("true")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseJson("{broken")).toBeNull();
  });

  it("handles nested objects", () => {
    const result = parseJson('{"a":{"b":1}}');
    expect(result).toEqual({ a: { b: 1 } });
  });
});

describe("getString", () => {
  it("returns string for non-empty string", () => {
    expect(getString("hello")).toBe("hello");
  });

  it("returns null for empty string", () => {
    expect(getString("")).toBeNull();
  });

  it("returns null for non-string types", () => {
    expect(getString(null)).toBeNull();
    expect(getString(undefined)).toBeNull();
    expect(getString(42)).toBeNull();
    expect(getString(true)).toBeNull();
    expect(getString({})).toBeNull();
  });
});

describe("parseMaybeJson", () => {
  it("parses valid JSON string", () => {
    expect(parseMaybeJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("returns original string for invalid JSON", () => {
    expect(parseMaybeJson("not json")).toBe("not json");
  });

  it("passes through non-string values", () => {
    expect(parseMaybeJson(42)).toBe(42);
    expect(parseMaybeJson(true)).toBe(true);
    const obj = { a: 1 };
    expect(parseMaybeJson(obj)).toBe(obj);
  });

  it("returns null for null/undefined", () => {
    expect(parseMaybeJson(null)).toBeNull();
    expect(parseMaybeJson(undefined)).toBeNull();
  });
});
