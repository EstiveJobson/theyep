const AVATAR_PATH_RE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([A-Za-z0-9_-][A-Za-z0-9._-]*)$/i;

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

function pathFromUrl(bucket: string, value: string): string | null {
  try {
    const parts = new URL(value).pathname.split("/").filter(Boolean);
    const marker = parts.lastIndexOf(bucket);
    if (marker < 0) return null;
    const uuid = parts[marker + 1];
    const file = parts[marker + 2];
    if (!uuid || !file) return null;
    return normalizeAvatarPath(`${decodePath(uuid)}/${decodePath(file)}`);
  } catch {
    return null;
  }
}

/** Storage path for an avatar stored as a path or as a Supabase object URL. */
export function avatarStoragePath(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return normalizeAvatarPath(trimmed) ?? pathFromUrl("avatars", trimmed);
}

/** Storage path for a post photo stored as a path or as a Supabase object URL. */
export function postPhotoPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return normalizeAvatarPath(trimmed) ?? pathFromUrl("post-photos", trimmed);
}

/** Path only when the folder is this profile. Other people's files are not signed. */
export function ownedStoragePath(ownerId: string, value: string | null | undefined): string | null {
  if (!ownerId) return null;
  const path = avatarStoragePath(value);
  if (!path) return null;
  const folder = path.slice(0, path.indexOf("/"));
  if (folder !== ownerId.toLowerCase()) return null;
  return path;
}
