import type { SupabaseClient } from "@supabase/supabase-js";
import { avatarStoragePath } from "@/lib/avatar-path";
import { SIGNED_URL_SECONDS } from "@/lib/signed-url";

export function avatarForDisplay(raw: string | null, signed: Map<string, string>): string | null {
  if (!raw) return null;
  const next = signed.get(raw);
  if (next) return next;
  if (avatarStoragePath(raw)) return null;
  return raw;
}

export async function signAvatarDisplayUrl(
  supabase: SupabaseClient,
  value: string | null,
): Promise<string | null> {
  if (!value) return null;
  const path = avatarStoragePath(value);
  if (!path) return value;
  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
