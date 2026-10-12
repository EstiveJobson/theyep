"use server";

import { revalidatePath } from "next/cache";
import { cleanCursor, type FeedCursor } from "@/lib/feed-cursor";
import type { FollowDirection, FollowPerson, FollowStats } from "@/lib/follows";
import { isUuid } from "@/lib/ids";
import { getViewer } from "@/lib/viewer";

const PAGE = 20;

const FOLLOW_ERROR = "Não foi possível seguir este perfil.";
const FOLLOW_RETRY = "Não foi possível seguir este perfil. Tente de novo.";
const UNFOLLOW_ERROR = "Não foi possível deixar de seguir. Tente de novo.";

type StatsRow = {
  followers: number | string | null;
  following_count: number | string | null;
  viewer_follows: boolean | null;
};

type PersonRow = {
  profile_id: string;
  name: string | null;
  avatar_url: string | null;
  school_short_name: string | null;
  followed_at: string;
};

function asCount(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.trunc(n);
}

function isDuplicateFollow(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "23505" || /duplicate key/i.test(error.message ?? "");
}

function followFailure(status: number | undefined): string {
  if (status === 0 || (typeof status === "number" && status >= 500)) return FOLLOW_RETRY;
  return FOLLOW_ERROR;
}

function refreshFollows(viewerId: string, profileId: string) {
  revalidatePath("/");
  revalidatePath("/perfil");
  revalidatePath(`/perfil/${viewerId}`);
  revalidatePath(`/perfil/${viewerId}/seguidores`);
  revalidatePath(`/perfil/${viewerId}/seguindo`);
  revalidatePath(`/perfil/${profileId}`);
  revalidatePath(`/perfil/${profileId}/seguidores`);
  revalidatePath(`/perfil/${profileId}/seguindo`);
}

export async function getFollowStats(
  profileId: string,
): Promise<{ ok: true; stats: FollowStats } | { ok: false; error: string }> {
  const { supabase, user } = await getViewer();
  if (!supabase || !user) return { ok: false, error: "Entre para ver os seguidores." };
  if (!isUuid(profileId)) return { ok: false, error: "Não foi possível carregar os seguidores." };

  const { data, error } = await supabase.rpc("follow_stats", { p_profile: profileId });
  if (error) return { ok: false, error: "Não foi possível carregar os seguidores." };

  const row = ((data ?? []) as StatsRow[])[0];
  if (!row) return { ok: false, error: "Não foi possível carregar os seguidores." };

  return {
    ok: true,
    stats: {
      followers: asCount(row.followers),
      following: asCount(row.following_count),
      viewerFollows: Boolean(row.viewer_follows),
    },
  };
}

export async function setFollow(
  profileId: string,
  follow: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const fail = follow ? FOLLOW_ERROR : UNFOLLOW_ERROR;
  const { supabase, user } = await getViewer();
  if (!supabase || !user) return { ok: false, error: fail };
  if (!isUuid(profileId) || profileId === user.id) return { ok: false, error: fail };

  if (follow) {
    try {
      const { error, status } = await supabase.from("follows").insert({ following_id: profileId });
      if (error && !isDuplicateFollow(error)) {
        return { ok: false, error: followFailure(status) };
      }
    } catch {
      return { ok: false, error: FOLLOW_RETRY };
    }
  } else {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("following_id", profileId)
      .eq("follower_id", user.id);
    if (error) return { ok: false, error: fail };
  }

  refreshFollows(user.id, profileId);
  return { ok: true };
}

export async function loadFollowList(input: {
  profileId: string;
  direction: FollowDirection;
  cursor?: FeedCursor | null;
}): Promise<
  { ok: true; people: FollowPerson[]; nextCursor: FeedCursor | null } | { ok: false; error: string }
> {
  const { supabase, user } = await getViewer();
  if (!supabase || !user) return { ok: false, error: "Entre para ver essa lista." };
  if (!isUuid(input.profileId)) return { ok: false, error: "Não foi possível carregar a lista." };
  if (input.direction !== "seguidores" && input.direction !== "seguindo") {
    return { ok: false, error: "Não foi possível carregar a lista." };
  }
  if (input.cursor && !cleanCursor(input.cursor)) {
    return { ok: false, error: "Não foi possível carregar a lista." };
  }
  const cursor = cleanCursor(input.cursor);

  const { data, error } = await supabase.rpc("list_follows", {
    p_profile: input.profileId,
    p_direction: input.direction,
    p_cursor_at: cursor?.createdAt ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: PAGE + 1,
  });
  if (error) return { ok: false, error: "Não foi possível carregar a lista." };

  const rows = ((data ?? []) as PersonRow[]).slice(0, PAGE + 1);
  const page = rows.slice(0, PAGE);
  const people = page.map((row) => ({
    id: row.profile_id,
    name: row.name?.trim() || "Sem nome",
    avatarUrl: row.avatar_url,
    schoolShortName: row.school_short_name?.trim() || null,
    followedAt: row.followed_at,
  }));
  const last = people.length === PAGE ? page[PAGE - 1] : null;
  const nextCursor =
    rows.length > PAGE && last ? { createdAt: last.followed_at, id: last.profile_id } : null;

  return { ok: true, people, nextCursor };
}
