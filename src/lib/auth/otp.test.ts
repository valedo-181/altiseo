import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeOtp } from "./otp.ts";

test("normalizeOtp accepte 6 chiffres, avec ou sans espaces", () => {
  assert.equal(normalizeOtp("123456"), "123456");
  assert.equal(normalizeOtp(" 123 456 "), "123456");
  assert.equal(normalizeOtp("123-456"), "123456");
  assert.equal(normalizeOtp("12345678"), "12345678");
});

test("normalizeOtp refuse ce qui n'est pas un code", () => {
  assert.equal(normalizeOtp(""), null);
  assert.equal(normalizeOtp("12345"), null);
  assert.equal(normalizeOtp("12a456"), null);
  assert.equal(normalizeOtp("12345678901"), null);
});
