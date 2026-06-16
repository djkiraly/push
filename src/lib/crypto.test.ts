import { describe, expect, it } from "vitest";

// crypto.ts reads PUSH_MASTER_KEY via env() lazily inside encrypt/decrypt, and
// env() validates the whole schema (so PUSH_MASTER_KEY must be present and
// 64 hex chars). Set it before the module is imported. Each test file has its
// own module graph, so this does not leak into other suites.
process.env.PUSH_MASTER_KEY = "a1".repeat(32); // 64 hex chars

const { encrypt, decrypt, isEncrypted } = await import("@/lib/crypto");

describe("crypto round-trip", () => {
  it.each([
    "hello world",
    "",
    "with spaces and\nnewlines\ttabs",
    "unicode: 日本語 — émojis 🚀🔥",
    "x".repeat(10_000),
    JSON.stringify({ access_token: "EAAB...", nested: { a: 1 } }),
  ])("decrypt(encrypt(x)) === x for %j", (plaintext) => {
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });
});

describe("ciphertext format", () => {
  it("is v1.<iv>.<tag>.<ct> with four dot-separated hex parts", () => {
    const payload = encrypt("secret");
    const parts = payload.split(".");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("v1");
    // iv is 12 bytes = 24 hex chars; tag is 16 bytes = 32 hex chars.
    expect(parts[1]).toMatch(/^[0-9a-f]{24}$/);
    expect(parts[2]).toMatch(/^[0-9a-f]{32}$/);
    expect(parts[3]).toMatch(/^[0-9a-f]*$/);
  });

  it("uses a fresh random IV per call (same plaintext → different ciphertext)", () => {
    const a = encrypt("same");
    const b = encrypt("same");
    expect(a).not.toBe(b);
    // ...but both still decrypt back to the original.
    expect(decrypt(a)).toBe("same");
    expect(decrypt(b)).toBe("same");
  });
});

describe("isEncrypted", () => {
  it("recognises this scheme's output", () => {
    expect(isEncrypted(encrypt("x"))).toBe(true);
  });
  it("rejects plaintext and other version prefixes", () => {
    expect(isEncrypted("plain token")).toBe(false);
    expect(isEncrypted("v2.aa.bb.cc")).toBe(false);
    expect(isEncrypted("")).toBe(false);
  });
});

describe("decrypt rejects malformed input", () => {
  it.each([
    ["wrong part count", "v1.aa.bb"],
    ["unsupported version", "v2.aa.bb.cc"],
    ["empty string", ""],
    ["not this format at all", "just-a-plain-string"],
  ])("throws on %s", (_label, payload) => {
    expect(() => decrypt(payload)).toThrow(/malformed or unsupported/);
  });
});

describe("decrypt detects tampering (GCM auth tag)", () => {
  function flipLastHexChar(s: string): string {
    const last = s[s.length - 1]!;
    const replacement = last === "0" ? "1" : "0";
    return s.slice(0, -1) + replacement;
  }

  it("rejects a mutated ciphertext body", () => {
    const [v, iv, tag, ct] = encrypt("authentic").split(".");
    const tampered = [v, iv, tag, flipLastHexChar(ct!)].join(".");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("rejects a mutated auth tag", () => {
    const [v, iv, tag, ct] = encrypt("authentic").split(".");
    const tampered = [v, iv, flipLastHexChar(tag!), ct].join(".");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("rejects a swapped IV", () => {
    const [v, , tag, ct] = encrypt("authentic").split(".");
    const otherIv = encrypt("authentic").split(".")[1]!;
    const tampered = [v, otherIv, tag, ct].join(".");
    expect(() => decrypt(tampered)).toThrow();
  });
});
