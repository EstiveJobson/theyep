"use server";

import { revalidatePath } from "next/cache";
import { isOwnPhotoPath, isUuid } from "@/lib/ids";
import { cleanCursor, type FeedCursor } from "@/lib/feed-cursor";
import { mapPostRow, type PostRow } from "@/lib/map-post";
import { getViewer } from "@/lib/viewer";
import type { FeedTab } from "@/lib/feed-tab";

export type { FeedCursor };

export type FeedPost = {
  id: string;
  text: string | null;
  photoUrl: string | null;
  photoMissing: boolean;
  createdAt: string;
  schoolShortName: string | null;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  author: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
};

const PAGE = 20;
const SIGNED_URL_SECONDS = 900;

function charCount(value: string): number {
  return [...value].length;
}

async function withSignedPhotos(
  supabase: NonNullable<Awaited<ReturnType<typeof getViewer>>["supabase"]>,
  rows: PostRow[],
) {
  const paths = rows.map((row) => row.photo_path).filter((path): path is string => Boolean(path));
  const signed = new Map<string, string>();
  if (paths.length === 0) return rows.map((row) => mapPostRow(row, signed));

  const { data: files } = await supabase.storage
    .from("post-photos")
    .createSignedUrls(paths, SIGNED_URL_SECONDS);
  for (const [index, file] of (files ?? []).entries()) {
    if (!file.signedUrl) continue;
    const key = file.path || paths[index];
    if (key) signed.set(key, file.signedUrl);
    const requested = paths[index];
    if (requested) signed.set(requested, file.signedUrl);
  }
  return rows.map((row) => mapPostRow(row, signed));
}

export async function loadFeed(input: {
  tab: FeedTab;
  cursor?: FeedCursor | null;
}): Promise<
  | { ok: true; posts: FeedPost[]; nextCursor: FeedCursor | null; followsNobody: boolean }
  | { ok: false; error: string }
> {
  const { supabase, user, school } = await getViewer();
  if (!supabase) {
    return { ok: false, error: "O feed ainda não está ligado. Falta configurar o Supabase." };
  }
  if (!user) return { ok: false, error: "Entre para ver os posts." };

  const tab: FeedTab =
    input.tab === "campus" ? "campus" : input.tab === "seguindo" ? "seguindo" : "geral";
  if (tab === "campus" && !school) return { ok: false, error: "Sua conta não tem escola." };

  if (input.cursor && !cleanCursor(input.cursor)) {
    return { ok: false, error: "Não foi possível carregar os posts." };
  }
  const cursor = cleanCursor(input.cursor);

  const { data, error } = await supabase.rpc("list_posts", {
    p_tab: tab,
    p_cursor_at: cursor?.createdAt ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: PAGE + 1,
  });

  if (error) return { ok: false, error: "Não foi possível carregar os posts." };

  const rows = ((data ?? []) as PostRow[]).slice(0, PAGE + 1);
  const page = rows.slice(0, PAGE);
  const posts = await withSignedPhotos(supabase, page);
  const last = posts.length === PAGE ? page[PAGE - 1] : null;
  const nextCursor =
    rows.length > PAGE && last ? { createdAt: last.created_at, id: last.id } : null;

  let followsNobody = false;
  if (tab === "seguindo" && !cursor && page.length === 0) {
    const { count, error: countError } = await supabase
      .from("follows")
      .select("following_id", { count: "exact", head: true })
      .eq("follower_id", user.id);
    if (!countError && count === 0) followsNobody = true;
  }

  return { ok: true, posts, nextCursor, followsNobody };
}

export async function createPost(input: {
  text: string;
  photoPath: string | null;
  toGeneral: boolean;
  toCampus: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user, school } = await getViewer();
  if (!supabase) {
    return { ok: false, error: "O login ainda não está ligado. Falta configurar o Supabase." };
  }
  if (!user) return { ok: false, error: "Entre para publicar." };

  const text = input.text.replace(/\r\n/g, "\n").trim();
  if (charCount(text) > 500) {
    return { ok: false, error: "O texto pode ter no máximo 500 caracteres." };
  }

  const photoPath = input.photoPath?.trim() || null;
  if (photoPath && !isOwnPhotoPath(user.id, photoPath)) {
    return { ok: false, error: "Não foi possível publicar a foto." };
  }
  if (!text && !photoPath) return { ok: false, error: "Escreva algo ou escolha uma foto." };

  const toGeneral = Boolean(input.toGeneral);
  const toCampus = Boolean(input.toCampus) && Boolean(school);
  if (!toGeneral && !toCampus) return { ok: false, error: "Escolha onde publicar." };

  const { error } = await supabase.from("posts").insert({
    text: text || null,
    photo_path: photoPath,
    to_general: toGeneral,
    to_campus: toCampus,
  });

  if (error) return { ok: false, error: "Não foi possível publicar. Tente de novo." };

  revalidatePath("/");
  return { ok: true };
}

export async function deletePost(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user } = await getViewer();
  if (!supabase || !user) return { ok: false, error: "Entre para apagar." };
  if (!isUuid(id)) return { ok: false, error: "Não foi possível apagar esse post." };

  const { data, error: readError } = await supabase
    .from("posts")
    .select("id, author_id, photo_path")
    .eq("id", id)
    .maybeSingle();

  const post = data as { id: string; author_id: string; photo_path: string | null } | null;
  if (readError || !post || post.author_id !== user.id) {
    return { ok: false, error: "Não foi possível apagar esse post." };
  }

  const photoPath = post.photo_path;
  const { error } = await supabase.from("posts").delete().eq("id", id).eq("author_id", user.id);
  if (error) return { ok: false, error: "Não foi possível apagar esse post." };

  if (photoPath) {
    const { error: storageError } = await supabase.storage.from("post-photos").remove([photoPath]);
    if (storageError) {
      console.error("post photo delete failed", { postId: id, message: storageError.message });
    }
  }

  revalidatePath("/");
  revalidatePath(`/post/${id}`);
  return { ok: true };
}
