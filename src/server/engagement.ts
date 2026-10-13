"use server";

import { revalidatePath } from "next/cache";
import { cleanCursor, type FeedCursor } from "@/lib/feed-cursor";
import {
  canDeleteComment,
  commentError,
  isDuplicateLike,
  normalizeComment,
} from "@/lib/engagement-rules";
import { avatarForDisplay } from "@/lib/avatar-url";
import { isUuid } from "@/lib/ids";
import type { PostRow } from "@/lib/map-post";
import type { FeedPost } from "@/server/posts";
import { signAvatarValues, signFeedPosts } from "@/server/media";
import { getViewer } from "@/lib/viewer";

export type CommentItem = {
  id: string;
  text: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
};

type CommentRow = {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
  author_name: string | null;
  avatar_url: string | null;
};

const POST_PAGE = 20;
const COMMENT_PAGE = 50;

function mapComment(row: CommentRow, avatars: Map<string, string>): CommentItem {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
    author: {
      id: row.user_id,
      name: row.author_name?.trim() || "Sem nome",
      avatarUrl: avatarForDisplay(row.user_id, avatars),
    },
  };
}

export async function loadAuthorPosts(input: {
  authorId: string;
  cursor?: FeedCursor | null;
}): Promise<
  { ok: true; posts: FeedPost[]; nextCursor: FeedCursor | null } | { ok: false; error: string }
> {
  const { supabase, user } = await getViewer();
  if (!supabase) {
    return { ok: false, error: "O feed ainda não está ligado. Falta configurar o Supabase." };
  }
  if (!user) return { ok: false, error: "Entre para ver os posts." };
  if (!isUuid(input.authorId)) return { ok: false, error: "Não foi possível carregar os posts." };
  if (input.cursor && !cleanCursor(input.cursor)) {
    return { ok: false, error: "Não foi possível carregar os posts." };
  }
  const cursor = cleanCursor(input.cursor);

  const { data, error } = await supabase.rpc("list_author_posts", {
    p_author: input.authorId,
    p_cursor_at: cursor?.createdAt ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: POST_PAGE + 1,
  });
  if (error) return { ok: false, error: "Não foi possível carregar os posts." };

  const rows = ((data ?? []) as PostRow[]).slice(0, POST_PAGE + 1);
  const page = rows.slice(0, POST_PAGE);
  const posts = await signFeedPosts(supabase, page);
  const last = posts.length === POST_PAGE ? page[POST_PAGE - 1] : null;
  const nextCursor =
    rows.length > POST_PAGE && last ? { createdAt: last.created_at, id: last.id } : null;
  return { ok: true, posts, nextCursor };
}

async function loadCommentPage(
  supabase: NonNullable<Awaited<ReturnType<typeof getViewer>>["supabase"]>,
  postId: string,
  cursor: FeedCursor | null,
): Promise<
  | { ok: true; comments: CommentItem[]; nextCursor: FeedCursor | null }
  | { ok: false; error: string }
> {
  const { data, error } = await supabase.rpc("list_comments", {
    p_post: postId,
    p_cursor_at: cursor?.createdAt ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: COMMENT_PAGE + 1,
  });
  if (error) return { ok: false, error: "Não foi possível carregar os comentários." };

  const rows = ((data ?? []) as CommentRow[]).slice(0, COMMENT_PAGE + 1);
  const pageRows = rows.slice(0, COMMENT_PAGE);
  const avatars = await signAvatarValues(
    supabase,
    pageRows.map((row) => ({ ownerId: row.user_id, avatarUrl: row.avatar_url })),
  );
  const page = pageRows.map((row) => mapComment(row, avatars));
  const last = page.length === COMMENT_PAGE ? rows[COMMENT_PAGE - 1] : null;
  const nextCursor =
    rows.length > COMMENT_PAGE && last ? { createdAt: last.created_at, id: last.id } : null;
  return { ok: true, comments: page, nextCursor };
}

export async function loadPostPage(
  id: string,
): Promise<
  | { ok: true; post: FeedPost; comments: CommentItem[]; nextCursor: FeedCursor | null }
  | { ok: false; notFound: boolean; error: string }
> {
  const { supabase, user } = await getViewer();
  if (!supabase) {
    return {
      ok: false,
      notFound: false,
      error: "O feed ainda não está ligado. Falta configurar o Supabase.",
    };
  }
  if (!user) return { ok: false, notFound: false, error: "Entre para ver o post." };
  if (!isUuid(id)) return { ok: false, notFound: true, error: "Post não encontrado" };

  const { data, error } = await supabase.rpc("get_post", { p_id: id });
  if (error) return { ok: false, notFound: false, error: "Não foi possível carregar o post." };

  const row = ((data ?? []) as PostRow[])[0];
  if (!row) return { ok: false, notFound: true, error: "Post não encontrado" };

  const [post] = await signFeedPosts(supabase, [row]);
  const comments = await loadCommentPage(supabase, id, null);
  if (!comments.ok) return { ok: false, notFound: false, error: comments.error };
  return { ok: true, post, comments: comments.comments, nextCursor: comments.nextCursor };
}

export async function loadMoreComments(input: {
  postId: string;
  cursor: FeedCursor;
}): Promise<
  | { ok: true; comments: CommentItem[]; nextCursor: FeedCursor | null }
  | { ok: false; error: string }
> {
  const { supabase, user } = await getViewer();
  if (!supabase || !user) return { ok: false, error: "Entre para ver os comentários." };
  if (!isUuid(input.postId) || !cleanCursor(input.cursor)) {
    return { ok: false, error: "Não foi possível carregar os comentários." };
  }
  return loadCommentPage(supabase, input.postId, cleanCursor(input.cursor));
}

export async function toggleLike(
  postId: string,
  like: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user } = await getViewer();
  if (!supabase) {
    return { ok: false, error: "O feed ainda não está ligado. Falta configurar o Supabase." };
  }
  if (!user) return { ok: false, error: "Entre para curtir." };
  if (!isUuid(postId)) {
    return {
      ok: false,
      error: like ? "Não foi possível curtir." : "Não foi possível desfazer a curtida.",
    };
  }

  if (like) {
    const { error } = await supabase.from("likes").insert({ post_id: postId });
    if (error && !isDuplicateLike(error)) {
      return { ok: false, error: "Não foi possível curtir. Tente de novo." };
    }
  } else {
    const { error } = await supabase
      .from("likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: "Não foi possível desfazer a curtida. Tente de novo." };
  }

  revalidatePath("/");
  revalidatePath(`/post/${postId}`);
  return { ok: true };
}

export async function createComment(
  postId: string,
  rawText: string,
): Promise<{ ok: true; comment: CommentItem } | { ok: false; error: string }> {
  const { supabase, user } = await getViewer();
  if (!supabase) {
    return { ok: false, error: "O feed ainda não está ligado. Falta configurar o Supabase." };
  }
  if (!user) return { ok: false, error: "Entre para comentar." };
  if (!isUuid(postId)) return { ok: false, error: "Não foi possível comentar." };

  const text = normalizeComment(rawText);
  const invalid = commentError(text);
  if (invalid) return { ok: false, error: invalid };

  const { data, error } = await supabase
    .from("comments")
    .insert({ post_id: postId, text })
    .select("id, user_id, text, created_at")
    .single();

  if (error || !data) return { ok: false, error: "Não foi possível comentar. Tente de novo." };

  const row = data as { id: string; user_id: string; text: string; created_at: string };
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const author = profile as { name: string | null; avatar_url: string | null } | null;
  const avatars = await signAvatarValues(supabase, [
    { ownerId: row.user_id, avatarUrl: author?.avatar_url ?? null },
  ]);

  revalidatePath("/");
  revalidatePath(`/post/${postId}`);
  return {
    ok: true,
    comment: {
      id: row.id,
      text: row.text,
      createdAt: row.created_at,
      author: {
        id: row.user_id,
        name: author?.name?.trim() || "Sem nome",
        avatarUrl: avatarForDisplay(row.user_id, avatars),
      },
    },
  };
}

export async function deleteComment(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user } = await getViewer();
  if (!supabase || !user) return { ok: false, error: "Entre para apagar." };
  if (!isUuid(id)) return { ok: false, error: "Não foi possível apagar esse comentário." };

  const { data, error: readError } = await supabase
    .from("comments")
    .select("id, user_id, post_id")
    .eq("id", id)
    .maybeSingle();

  const comment = data as { id: string; user_id: string; post_id: string } | null;
  if (readError || !comment)
    return { ok: false, error: "Não foi possível apagar esse comentário." };

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", comment.post_id)
    .maybeSingle();
  const postAuthorId = (post as { author_id: string } | null)?.author_id;
  if (postError || !postAuthorId || !canDeleteComment(user.id, comment.user_id, postAuthorId)) {
    return { ok: false, error: "Não foi possível apagar esse comentário." };
  }

  const { data: removed, error } = await supabase
    .from("comments")
    .delete()
    .eq("id", id)
    .select("id");
  if (error || !removed?.length) {
    return { ok: false, error: "Não foi possível apagar esse comentário." };
  }

  revalidatePath("/");
  revalidatePath(`/post/${comment.post_id}`);
  return { ok: true };
}
