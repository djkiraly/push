import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "./env";

// AES-256-GCM. Layout of stored ciphertext:
//   v1.<iv-hex>.<authTag-hex>.<ciphertext-hex>
// Versioning prefix lets us migrate to a new scheme later without losing data.

const VERSION = "v1";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

function key(): Buffer {
  return Buffer.from(env().PUSH_MASTER_KEY, "hex");
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("hex"), tag.toString("hex"), ct.toString("hex")].join(".");
}

export function decrypt(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("crypto: malformed or unsupported ciphertext");
  }
  const [, ivHex, tagHex, ctHex] = parts as [string, string, string, string];
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctHex, "hex")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(`${VERSION}.`);
}
