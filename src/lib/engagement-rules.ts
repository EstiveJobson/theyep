export const COMMENT_MAX = 300;

export function charCount(value: string): number {
  return [...value].length;
}

// Spaces and invisible characters. Trimmed only at the edges so a joiner
// inside composed emoji (👨‍👩‍👧, 🏳️‍🌈) stays put. The empty check uses a copy.
const INVISIBLE_CHARS =
  "\\s\\u200b-\\u200d\\u2060\\ufeff\\u202f\\u00ad\\u3164\\u2800\\u115f\\u1160\\uffa0\\u180e";
const INVISIBLE = new RegExp(`[${INVISIBLE_CHARS}\\u00a0]`, "g");
const INVISIBLE_EDGE = new RegExp(`^[${INVISIBLE_CHARS}]+|[${INVISIBLE_CHARS}]+$`, "g");

export function normalizeComment(input: string): string {
  return input.replace(/\r\n/g, "\n").replace(INVISIBLE_EDGE, "");
}

export function commentError(text: string): string | null {
  if (!text.replace(INVISIBLE, "")) return "Escreva um comentário.";
  if (charCount(text) > COMMENT_MAX) return "O comentário pode ter no máximo 300 caracteres.";
  return null;
}

export function commentLabel(count: number): string {
  return count === 1 ? "1 comentário" : `${count} comentários`;
}

export function isDuplicateLike(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  return error.code === "23505" || /duplicate key/i.test(error.message ?? "");
}

export function canDeleteComment(
  viewerId: string,
  commentUserId: string,
  postAuthorId: string,
): boolean {
  return viewerId === commentUserId || viewerId === postAuthorId;
}

export function nextLikeCount(count: number, like: boolean): number {
  return Math.max(0, count + (like ? 1 : -1));
}
