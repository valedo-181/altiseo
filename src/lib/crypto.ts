import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Chiffrement des identifiants CMS (AES-256-GCM). Clé : ENCRYPTION_KEY, 32 octets en base64
 * (`openssl rand -base64 32`). Format : version (1) | iv (12) | tag (16) | données.
 */
function key(raw = process.env.ENCRYPTION_KEY): Buffer {
  const k = raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (k.length !== 32) throw new Error("ENCRYPTION_KEY doit faire 32 octets en base64 (openssl rand -base64 32)");
  return k;
}

export function encryptSecret(plain: string, rawKey?: string): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(rawKey), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([Buffer.from([1]), iv, c.getAuthTag(), data]);
}

export function decryptSecret(blob: Buffer, rawKey?: string): string {
  if (blob[0] !== 1 || blob.length < 29) throw new Error("Format de secret inconnu");
  const d = createDecipheriv("aes-256-gcm", key(rawKey), blob.subarray(1, 13));
  d.setAuthTag(blob.subarray(13, 29));
  return Buffer.concat([d.update(blob.subarray(29)), d.final()]).toString("utf8");
}

/** bytea Postgres ↔ Buffer (PostgREST renvoie « \x… »). */
export const toBytea = (b: Buffer) => `\\x${b.toString("hex")}`;
export const fromBytea = (s: string) => Buffer.from(s.replace(/^\\x/, ""), "hex");
