export type BlockedPerson = {
  id: string;
  name: string;
  avatarUrl: string | null;
  blockedAt: string;
};

export function isDuplicateBlock(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  return error.code === "23505" || /duplicate key/i.test(error.message ?? "");
}
