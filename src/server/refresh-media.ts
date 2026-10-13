"use server";

import { ownedStoragePath } from "@/lib/avatar-path";
import { isUuid } from "@/lib/ids";
import { getViewer } from "@/lib/viewer";
import { signObjectPaths } from "@/server/media";

const MAX_IDS = 100;

function uniqueIds(values: string[]): string[] {
  return [...new Set(values.filter((value) => isUuid(value)))].slice(0, MAX_IDS);
}

export async function refreshSignedMedia(input: {
  postIds: string[];
  profileIds: string[];
}): Promise<{ posts: Record<string, string>; avatars: Record<string, string> }> {
  const posts: Record<string, string> = {};
  const avatars: Record<string, string> = {};
  const { supabase, user } = await getViewer();
  if (!supabase || !user) return { posts, avatars };

  const postIds = uniqueIds(input.postIds);
  const profileIds = uniqueIds(input.profileIds);

  if (postIds.length > 0) {
    const { data } = await supabase.from("posts").select("id, photo_path").in("id", postIds);
    const rows = (data ?? []) as { id: string; photo_path: string | null }[];
    const signed = await signObjectPaths(supabase, "post-photos", [
      ...new Set(rows.flatMap((row) => (row.photo_path ? [row.photo_path] : []))),
    ]);
    for (const row of rows) {
      if (!row.photo_path) continue;
      const url = signed.get(row.photo_path);
      if (url) posts[row.id] = url;
    }
  }

  if (profileIds.length > 0) {
    const { data } = await supabase.from("profiles").select("id, avatar_url").in("id", profileIds);
    const rows = (data ?? []) as { id: string; avatar_url: string | null }[];
    const owned = rows.flatMap((row) => {
      const path = ownedStoragePath(row.id, row.avatar_url);
      return path ? [{ id: row.id, path }] : [];
    });
    const signed = await signObjectPaths(supabase, "avatars", [
      ...new Set(owned.map((row) => row.path)),
    ]);
    for (const row of owned) {
      const url = signed.get(row.path);
      if (url) avatars[row.id] = url;
    }
  }

  return { posts, avatars };
}
