import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, generateToken } from "../src/auth.ts";

test("hashPassword produces a verifiable, salted hash", () => {
  const hash = hashPassword("Correct-Horse-1");
  assert.ok(hash.startsWith("scrypt$"));
  assert.equal(verifyPassword("Correct-Horse-1", hash), true);
  assert.equal(verifyPassword("wrong-password", hash), false);
});

test("hashing the same password twice yields different salts", () => {
  const a = hashPassword("same-password");
  const b = hashPassword("same-password");
  assert.notEqual(a, b);
});

test("generateToken produces unique, sufficiently long tokens", () => {
  const a = generateToken();
  const b = generateToken();
  assert.notEqual(a, b);
  assert.ok(a.length >= 32);
});
