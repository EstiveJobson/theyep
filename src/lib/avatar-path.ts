const AVATAR_PATH_RE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([A-Za-z0-9._-]+)$/i;

function decodePath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeAvatarPath(value: string): string | null {
  const match = AVATAR_PATH_RE.exec(value);
  if (!match) return null;
  const uuid = match[1];
  const file = match[2];
  if (!uuid || !file) return null;
  return `${uuid.toLowerCase()}/${file}`;
}

/** Storage path for an avatar stored as a path or as a Supabase object URL. */
export function avatarStoragePath(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const direct = normalizeAvatarPath(trimmed);
  if (direct) return direct;

  try {
    const parts = new URL(trimmed).pathname.split("/").filter(Boolean);
    const marker = parts.lastIndexOf("avatars");
    if (marker < 0) return null;
    const uuid = parts[marker + 1];
    const file = parts[marker + 2];
    if (!uuid || !file) return null;
    return normalizeAvatarPath(`${decodePath(uuid)}/${decodePath(file)}`);
  } catch {
    return null;
  }
}
