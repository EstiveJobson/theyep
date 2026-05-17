import type { CampusEvent, Student } from "../src/types";
import type { EventAuthorStats } from "./types";

export const EVENT_WEEKLY_LIMIT = 2;
export const EVENT_EDIT_LIMIT = 2;
export const EVENT_FALSE_BLOCK_THRESHOLD = 3;
export const EVENT_BLOCK_MONTHS = 1;

export function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function getStartOfWeek(date: Date) {
  const start = new Date(date);
  const dayOffset = (start.getDay() + 6) % 7;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - dayOffset);
  return start;
}

export function isSamePostingWeek(value: string, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const weekStart = getStartOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return date >= weekStart && date < weekEnd;
}

export function isEventPast(event: CampusEvent, now = new Date()) {
  return new Date(event.startsAt).getTime() < now.getTime();
}

export function getEventVerdict(event: CampusEvent, now = new Date()) {
  if (!isEventPast(event, now) || event.trueVotes === event.falseVotes) {
    return "pending" as const;
  }

  return event.trueVotes > event.falseVotes ? ("real" as const) : ("fake" as const);
}

export function formatEventDate(startsAt: string) {
  const eventDate = new Date(startsAt);
  if (Number.isNaN(eventDate.getTime())) return "Date TBD";

  const day = eventDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const time = eventDate.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${day}, ${time}`;
}

export function buildEventAuthorStats(campusEvents: CampusEvent[], now = new Date()) {
  const stats: Record<string, EventAuthorStats & { fakeDates: Date[] }> = {};

  campusEvents.forEach((event) => {
    const handle = event.author.handle;
    if (!stats[handle]) {
      stats[handle] = { posted: 0, real: 0, fake: 0, fakeDates: [] };
    }

    stats[handle].posted += 1;

    const verdict = getEventVerdict(event, now);
    if (verdict === "real") {
      stats[handle].real += 1;
    }
    if (verdict === "fake") {
      stats[handle].fake += 1;
      stats[handle].fakeDates.push(new Date(event.startsAt));
    }
  });

  return Object.fromEntries(
    Object.entries(stats).map(([handle, value]) => {
      const fakeDates = value.fakeDates
        .filter((date) => !Number.isNaN(date.getTime()))
        .sort((left, right) => left.getTime() - right.getTime());
      const latestFakeDate = fakeDates[fakeDates.length - 1];
      const blockedUntil =
        value.fake >= EVENT_FALSE_BLOCK_THRESHOLD && latestFakeDate
          ? addMonths(latestFakeDate, EVENT_BLOCK_MONTHS)
          : undefined;

      return [
        handle,
        {
          posted: value.posted,
          real: value.real,
          fake: value.fake,
          blockedUntil: blockedUntil && blockedUntil > now ? blockedUntil.toISOString() : undefined,
        },
      ];
    }),
  ) as Record<string, EventAuthorStats>;
}

export function getEventPostingStatus(
  author: Student,
  campusEvents: CampusEvent[],
  authorStats: Record<string, EventAuthorStats>,
  now = new Date(),
) {
  const postedThisWeek = campusEvents.filter(
    (event) => event.author.handle === author.handle && isSamePostingWeek(event.createdAt, now),
  ).length;
  const blockedUntil = authorStats[author.handle]?.blockedUntil;

  return {
    postedThisWeek,
    remainingThisWeek: Math.max(0, EVENT_WEEKLY_LIMIT - postedThisWeek),
    blockedUntil,
    isBlocked: Boolean(blockedUntil && new Date(blockedUntil) > now),
  };
}
