import type { SupabaseClient } from "@supabase/supabase-js";
import { ownedStoragePath } from "@/lib/avatar-path";
import { SIGNED_URL_SECONDS } from "@/lib/signed-url";

export function avatarForDisplay(ownerId: string, signed: Map<string, string>): string | null {
  return signed.get(ownerId) ?? null;
}

export async function signAvatarDisplayUrl(
  supabase: SupabaseClient,
  ownerId: string,
  value: string | null,
): Promise<string | null> {
  const path = ownedStoragePath(ownerId, value);
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
