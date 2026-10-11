import type { FeedPost } from "@/server/posts";

export type PostRow = {
  id: string;
  author_id: string;
  text: string | null;
  photo_path: string | null;
  created_at: string;
  author_name: string | null;
  avatar_url: string | null;
  school_short_name: string | null;
  like_count: number | string | null;
  comment_count: number | string | null;
  liked_by_me: boolean | null;
};

export function asCount(value: number | string | null | undefined): number {
  const count = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(count) || count < 0) return 0;
  return Math.trunc(count);
}

export function mapPostRow(row: PostRow, signed: Map<string, string>): FeedPost {
  return {
    id: row.id,
    text: row.text,
    photoUrl: row.photo_path ? (signed.get(row.photo_path) ?? null) : null,
    photoMissing: Boolean(row.photo_path) && !signed.has(row.photo_path ?? ""),
    createdAt: row.created_at,
    schoolShortName: row.school_short_name,
    likeCount: asCount(row.like_count),
    commentCount: asCount(row.comment_count),
    likedByMe: Boolean(row.liked_by_me),
    author: {
      id: row.author_id,
      name: row.author_name?.trim() || "Sem nome",
      avatarUrl: row.avatar_url,
    },
  };
}
