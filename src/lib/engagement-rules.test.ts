import assert from "node:assert/strict";
import test from "node:test";
import { commentError, normalizeComment } from "./engagement-rules.ts";

const family = "👨‍👩‍👧";
const flag = "🏳️‍🌈";

test("composed emoji round-trip unchanged", () => {
  assert.equal(normalizeComment(family), family);
  assert.equal(normalizeComment(flag), flag);
  assert.equal(normalizeComment(`  ${family}  `), family);
  assert.equal(normalizeComment(`\u200b${flag}\u200d`), flag);
  assert.equal(normalizeComment(`\u3164${family}\u2800`), family);
  assert.equal(normalizeComment(`\u00ad${flag}\uffa0`), flag);
  assert.equal(commentError(family), null);
  assert.equal(commentError(flag), null);
  assert.equal([...normalizeComment(family)].join(""), family);
});

test("invisible-only comments are empty", () => {
  for (const sample of [
    "\u202f",
    "\u00ad",
    "\u3164",
    "\u2800",
    "\u115f",
    "\u1160",
    "\uffa0",
    "\u180e",
  ]) {
    assert.equal(commentError(sample), "Escreva um comentário.");
  }
  assert.equal(normalizeComment("a\n\nb"), "a\n\nb");
});
