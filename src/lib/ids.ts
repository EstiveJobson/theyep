export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function isOwnPhotoPath(userId: string, path: string): boolean {
  if (!isUuid(userId)) return false;
  return new RegExp(`^${userId.toLowerCase()}/[A-Za-z0-9._-]+$`).test(path);
}
