import { isUuid } from "@/lib/ids";

const ISO_TIMESTAMP =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

export type FeedCursor = { createdAt: string; id: string };

/** Keep the original timestamp text. new Date() drops microseconds and skips rows. */
export function cleanCursor(cursor: FeedCursor | null | undefined): FeedCursor | null {
  if (!cursor) return null;
  if (!ISO_TIMESTAMP.test(cursor.createdAt) || !isUuid(cursor.id)) return null;
  return { createdAt: cursor.createdAt, id: cursor.id.toLowerCase() };
}
