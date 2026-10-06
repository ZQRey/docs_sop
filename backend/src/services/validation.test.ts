import test from "node:test";
import assert from "node:assert/strict";
import { validSignature } from "./validation";
test("reject disguised executable and accept document signatures", () => {
  assert.equal(validSignature(".pdf", Buffer.from("MZ executable")), false);
  assert.equal(validSignature(".pdf", Buffer.from("%PDF-1.7")), true);
  assert.equal(
    validSignature(".doc", Buffer.from("d0cf11e0a1b11ae1", "hex")),
    true,
  );
  assert.equal(validSignature(".docx", Buffer.from("504b0304", "hex")), true);
  assert.equal(validSignature(".exe", Buffer.from("504b0304", "hex")), false);
});
