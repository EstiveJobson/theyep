"use server";

import { isUuid } from "@/lib/ids";
import { signAvatarDisplayUrl } from "@/lib/avatar-url";
import { getViewer } from "@/lib/viewer";

export async function refreshAvatar(
  profileId: string,
): Promise<{ ok: true; url: string } | { ok: false }> {
  const { supabase, user } = await getViewer();
  if (!supabase || !user || !isUuid(profileId)) return { ok: false };

  const { data, error } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", profileId)
    .maybeSingle();
  if (error || !data) return { ok: false };

  const raw = (data as { avatar_url: string | null }).avatar_url;
  const url = await signAvatarDisplayUrl(supabase, profileId, raw);
  if (!url) return { ok: false };
  return { ok: true, url };
}
