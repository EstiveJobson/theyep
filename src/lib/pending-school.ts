import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isUuid } from "@/lib/ids";

export const PENDING_SCHOOL_KEY = "pending_school_id";

export type PendingSchoolResult = "applied" | "cleared" | "skipped" | "retry";

const inflight = new Map<string, Promise<PendingSchoolResult>>();

export function readPendingSchoolId(
  metadata: User["user_metadata"] | null | undefined,
): string | null {
  const value = metadata?.[PENDING_SCHOOL_KEY];
  if (typeof value !== "string") return null;
  const id = value.trim();
  return isUuid(id) ? id : null;
}

function isDefinitiveSchoolError(message: string): boolean {
  const text = message.toLowerCase();
  return (
    text.includes("already chosen") || text.includes("inactive") || text.includes("does not exist")
  );
}

async function clearPendingSchool(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    data: { [PENDING_SCHOOL_KEY]: null },
  });
  if (error) throw error;
}

async function applyNow(supabase: SupabaseClient, user: User): Promise<PendingSchoolResult> {
  const schoolId = readPendingSchoolId(user.user_metadata);
  if (!schoolId) return "skipped";

  const { error } = await supabase.rpc("set_my_school", { p_school: schoolId });
  const definitive =
    !error ||
    isDefinitiveSchoolError(`${error.message} ${error.details ?? ""} ${error.hint ?? ""}`);
  if (!definitive) return "retry";

  try {
    await clearPendingSchool(supabase);
  } catch (clearError) {
    console.error("pending school clear failed", clearError);
    if (error) return "retry";
  }
  return error ? "cleared" : "applied";
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
    if (!schoolId) return "skipped";

    const key = `${user.id}:${schoolId}`;
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
