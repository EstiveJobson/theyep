import assert from "node:assert/strict";
import test from "node:test";
import {
  PENDING_RETRY_COOKIE,
  PENDING_RETRY_SECONDS,
  pendingMetadataAction,
  pendingRetryActive,
  planPendingRpc,
} from "./pending-school-plan.ts";

const SCHOOL_ID = "aa000000-0000-4000-8000-00000000000a";

test("non-UUID pending values are cleared", () => {
  assert.equal(pendingMetadataAction("not-a-uuid"), "clear");
  assert.equal(pendingMetadataAction("   "), "clear");
  assert.equal(pendingMetadataAction(15), "clear");
  assert.equal(pendingMetadataAction("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"), "clear");
  assert.equal(pendingMetadataAction(undefined), "skip");
  assert.equal(pendingMetadataAction(null), "skip");
  assert.equal(pendingMetadataAction(SCHOOL_ID), "apply");
});

test("4xx pending school responses are final", () => {
  assert.deepEqual(planPendingRpc({ status: 400, message: "school already chosen" }), {
    action: "clear",
    notice: null,
  });
  assert.deepEqual(planPendingRpc({ status: 404, message: "profile not found" }), {
    action: "clear",
    notice: null,
  });
  assert.deepEqual(
    planPendingRpc({ status: 400, message: "school is inactive or does not exist" }),
    { action: "clear", notice: "inactive" },
  );
});

test("5xx and thrown errors set the 5-minute retry cookie", () => {
  const now = 1_700_000_000_000;
  const retry = planPendingRpc({ status: 503, message: "upstream timeout", now });
  assert.equal(retry.action, "retry");
  if (retry.action !== "retry") return;
  assert.equal(retry.cookie.name, PENDING_RETRY_COOKIE);
  assert.equal(retry.cookie.maxAge, PENDING_RETRY_SECONDS);
  assert.equal(retry.cookie.maxAge, 300);
  assert.equal(retry.cookie.value, String(now + 300_000));
  assert.equal(pendingRetryActive(retry.cookie.value, now + 299_000), true);
  assert.equal(pendingRetryActive(retry.cookie.value, now + 300_000), false);

  const thrown = planPendingRpc({ thrown: true, now });
  assert.equal(thrown.action, "retry");
  if (thrown.action !== "retry") return;
  assert.equal(thrown.cookie.name, "ps_retry_after");
  assert.equal(thrown.cookie.maxAge, 300);
});
