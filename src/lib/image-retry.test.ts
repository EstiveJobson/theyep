import assert from "node:assert/strict";
import test from "node:test";
import { imageRetryOnError, imageRetryReset } from "./image-retry.ts";

test("an image retries once, then falls back, even when each URL is new", () => {
  let state = imageRetryReset();
  const first = imageRetryOnError(state);
  assert.equal(first.action, "retry");
  state = first.state;

  const second = imageRetryOnError(state);
  assert.equal(second.action, "fallback");
  assert.equal(second.state.retried, true);

  const third = imageRetryOnError(second.state);
  assert.equal(third.action, "fallback");
});

test("the 10-minute tick or a new storage path clears the retry", () => {
  const afterError = imageRetryOnError(imageRetryReset());
  assert.equal(afterError.action, "retry");
  const again = imageRetryOnError(imageRetryReset());
  assert.equal(again.action, "retry");
});
