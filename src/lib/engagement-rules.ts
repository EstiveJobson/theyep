export const COMMENT_MAX = 300;

export function charCount(value: string): number {
  return [...value].length;
}

export function normalizeComment(input: string): string {
  return input.replace(/\r\n/g, "\n").trim();
}

export function commentError(text: string): string | null {
  if (!text) return "Escreva um comentário.";
  if (charCount(text) > COMMENT_MAX) return "O comentário pode ter no máximo 300 caracteres.";
  return null;
}

export function commentLabel(count: number): string {
  return count === 1 ? "1 comentário" : `${count} comentários`;
}

export function isDuplicateLike(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "23505" || /duplicate key/i.test(error.message ?? "");
}

export function canDeleteComment(viewerId: string, commentUserId: string, postAuthorId: string): boolean {
  return viewerId === commentUserId || viewerId === postAuthorId;
}

export function nextLikeCount(count: number, like: boolean): number {
  return Math.max(0, count + (like ? 1 : -1));
}
