import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret, fromBytea, toBytea } from "./crypto.ts";

test("chiffrement des identifiants : aller-retour, falsification détectée, mauvaise clé refusée", () => {
  const k = randomBytes(32).toString("base64");
  const blob = encryptSecret("abcd efgh ijkl mnop qrst uvwx", k);
  assert.equal(decryptSecret(fromBytea(toBytea(blob)), k), "abcd efgh ijkl mnop qrst uvwx");
  assert.notEqual(encryptSecret("x", k).toString("hex"), encryptSecret("x", k).toString("hex")); // iv aléatoire
  const bad = Buffer.from(blob); bad[bad.length - 1] ^= 1;
  assert.throws(() => decryptSecret(bad, k));
  assert.throws(() => decryptSecret(blob, randomBytes(32).toString("base64")));
  assert.throws(() => encryptSecret("x", "trop-court"));
});
