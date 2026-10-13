import type { SupabaseClient } from "@supabase/supabase-js";
import { ownedStoragePath } from "@/lib/avatar-path";
import { avatarForDisplay } from "@/lib/avatar-url";
import { mapPostRow, type PostRow } from "@/lib/map-post";
import { SIGNED_URL_SECONDS } from "@/lib/signed-url";
import type { FeedPost } from "@/server/posts";

type StorageBucket = "post-photos" | "avatars";

export async function signObjectPaths(
  supabase: SupabaseClient,
  bucket: StorageBucket,
  paths: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const signed = new Map<string, string>();
  if (unique.length === 0) return signed;

  const { data: files } = await supabase.storage
    .from(bucket)
    .createSignedUrls(unique, SIGNED_URL_SECONDS);
  for (const [index, file] of (files ?? []).entries()) {
    if (!file.signedUrl) continue;
    const key = file.path || unique[index];
    if (key) signed.set(key, file.signedUrl);
    const requested = unique[index];
    if (requested) signed.set(requested, file.signedUrl);
  }
  return signed;
}

export async function signAvatarValues(
  supabase: SupabaseClient,
  values: Array<{ ownerId: string; avatarUrl: string | null | undefined }>,
): Promise<Map<string, string>> {
  const ownerToPath = new Map<string, string>();
  for (const value of values) {
    const path = ownedStoragePath(value.ownerId, value.avatarUrl);
    if (path) ownerToPath.set(value.ownerId, path);
  }
  const signedPaths = await signObjectPaths(supabase, "avatars", [...ownerToPath.values()]);
  const signed = new Map<string, string>();
  for (const [ownerId, path] of ownerToPath) {
    const url = signedPaths.get(path);
    if (url) signed.set(ownerId, url);
  }
  return signed;
}

export async function signFeedPosts(
  supabase: SupabaseClient,
  rows: PostRow[],
): Promise<FeedPost[]> {
  const photoSigned = await signObjectPaths(
    supabase,
    "post-photos",
    rows.flatMap((row) => (row.photo_path ? [row.photo_path] : [])),
  );
  const avatarSigned = await signAvatarValues(
    supabase,
    rows.map((row) => ({ ownerId: row.author_id, avatarUrl: row.avatar_url })),
  );
  return rows.map((row) =>
    mapPostRow(
      {
        ...row,
        avatar_url: avatarForDisplay(row.author_id, avatarSigned),
      },
      photoSigned,
    ),
  );
}
