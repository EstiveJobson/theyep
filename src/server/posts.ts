"use server";

import { revalidatePath } from "next/cache";
import { isOwnPhotoPath, isUuid } from "@/lib/ids";
import { getViewer } from "@/lib/viewer";

export type FeedCursor = { createdAt: string; id: string };

export type FeedPost = {
  id: string;
  text: string | null;
  photoUrl: string | null;
  photoMissing: boolean;
  createdAt: string;
  schoolShortName: string | null;
  author: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
};

type FeedRow = {
  id: string;
  author_id: string;
  text: string | null;
  photo_path: string | null;
  created_at: string;
  author_name: string;
  avatar_url: string | null;
  school_short_name: string | null;
};

const PAGE = 20;

function charCount(value: string): number {
  return [...value].length;
}

function cleanCursor(cursor: FeedCursor | null | undefined): FeedCursor | null {
  if (!cursor) return null;
  const time = new Date(cursor.createdAt);
  if (Number.isNaN(time.getTime()) || !isUuid(cursor.id)) return null;
  return { createdAt: time.toISOString(), id: cursor.id.toLowerCase() };
}

export async function loadFeed(input: {
  tab: "geral" | "campus";
  cursor?: FeedCursor | null;
}): Promise<
  { ok: true; posts: FeedPost[]; nextCursor: FeedCursor | null } | { ok: false; error: string }
> {
  const { supabase, user, school } = await getViewer();
  if (!supabase) {
    return { ok: false, error: "O feed ainda não está ligado. Falta configurar o Supabase." };
  }
  if (!user) return { ok: false, error: "Entre para ver os posts." };

  const tab = input.tab === "campus" ? "campus" : "geral";
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

  const rows = ((data ?? []) as FeedRow[]).slice(0, PAGE + 1);
  const page = rows.slice(0, PAGE);
  const paths = page.map((row) => row.photo_path).filter((path): path is string => Boolean(path));
  const signed = new Map<string, string>();

  if (paths.length > 0) {
    const { data: files } = await supabase.storage
      .from("post-photos")
      .createSignedUrls(paths, 60 * 60 * 2);
    for (const [index, file] of (files ?? []).entries()) {
      if (!file.signedUrl) continue;
      const key = file.path || paths[index];
      if (key) signed.set(key, file.signedUrl);
      const requested = paths[index];
      if (requested) signed.set(requested, file.signedUrl);
    }
  }

  const posts: FeedPost[] = page.map((row) => ({
    id: row.id,
    text: row.text,
    photoUrl: row.photo_path ? (signed.get(row.photo_path) ?? null) : null,
    photoMissing: Boolean(row.photo_path) && !signed.has(row.photo_path ?? ""),
    createdAt: row.created_at,
    schoolShortName: row.school_short_name,
    author: {
      id: row.author_id,
      name: row.author_name?.trim() || "Sem nome",
      avatarUrl: row.avatar_url,
    },
  }));

  const last = posts.length === PAGE ? page[PAGE - 1] : null;
  const nextCursor =
    rows.length > PAGE && last ? { createdAt: last.created_at, id: last.id } : null;

  return { ok: true, posts, nextCursor };
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
    author_id: user.id,
    text: text || null,
    photo_path: photoPath,
    to_general: toGeneral,
    to_campus: toCampus,
    school_id: school?.id ?? null,
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

  if (post.photo_path) {
    const { error: storageError } = await supabase.storage
      .from("post-photos")
      .remove([post.photo_path]);
    if (storageError && !/not found|does not exist/i.test(storageError.message)) {
      return { ok: false, error: "Não foi possível apagar a foto. Tente de novo." };
    }
  }

  const { error } = await supabase.from("posts").delete().eq("id", id).eq("author_id", user.id);
  if (error) return { ok: false, error: "Não foi possível apagar esse post." };

  revalidatePath("/");
  return { ok: true };
}
