import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  pendingMetadataAction,
  planPendingRpc,
  type PendingRpcPlan,
} from "./pending-school-plan.ts";

export const PENDING_SCHOOL_KEY = "pending_school_id";

export type PendingSchoolResult = "applied" | "cleared" | "inactive" | "skipped" | "retry";

const inflight = new Map<string, Promise<PendingSchoolResult>>();

export function readPendingSchoolId(
  metadata: User["user_metadata"] | null | undefined,
): string | null {
  const value = metadata?.[PENDING_SCHOOL_KEY];
  if (pendingMetadataAction(value) !== "apply") return null;
  return typeof value === "string" ? value.trim() : null;
}

async function clearPendingSchool(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    data: { [PENDING_SCHOOL_KEY]: null },
  });
  if (error) throw error;
}

async function finishPlan(
  supabase: SupabaseClient,
  plan: PendingRpcPlan,
): Promise<PendingSchoolResult> {
  if (plan.action === "retry") return "retry";

  try {
    await clearPendingSchool(supabase);
  } catch (clearError) {
    console.error("pending school clear failed", clearError);
    return "retry";
  }

  if (plan.action === "ok") return "applied";
  if (plan.action === "clear") return plan.notice === "inactive" ? "inactive" : "cleared";

  const unreachable: never = plan;
  return unreachable;
}

async function applyNow(supabase: SupabaseClient, user: User): Promise<PendingSchoolResult> {
  const raw = user.user_metadata?.[PENDING_SCHOOL_KEY];
  const metadataAction = pendingMetadataAction(raw);
  if (metadataAction === "skip") return "skipped";
  if (metadataAction === "clear") {
    return finishPlan(supabase, { action: "clear", notice: null });
  }

  const schoolId = typeof raw === "string" ? raw.trim() : "";
  try {
    const { error, status } = await supabase.rpc("set_my_school", { p_school: schoolId });
    const plan = planPendingRpc({
      ok: !error,
      status,
      message: error ? `${error.message} ${error.details ?? ""} ${error.hint ?? ""}` : "",
    });
    return finishPlan(supabase, plan);
  } catch (error) {
    console.error("pending school", error);
    return "retry";
  }
}

// Applies a signup choice with set_my_school. handle_new_user does not write school_id.
export async function applyPendingSchool(
  supabase: SupabaseClient,
  knownUser?: User | null,
): Promise<PendingSchoolResult> {
  try {
    let user = knownUser ?? null;
    if (!user) {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return "skipped";
      user = data.user;
    }

    const schoolId = readPendingSchoolId(user.user_metadata);
    const metadataAction = pendingMetadataAction(user.user_metadata?.[PENDING_SCHOOL_KEY]);
    if (metadataAction === "skip") return "skipped";

    const key = `${user.id}:${schoolId ?? "invalid"}`;
    const existing = inflight.get(key);
    if (existing) return existing;

    const promise = applyNow(supabase, user).finally(() => {
      inflight.delete(key);
    });
    inflight.set(key, promise);
    return await promise;
  } catch (error) {
    console.error("pending school", error);
    return "retry";
  }
}
