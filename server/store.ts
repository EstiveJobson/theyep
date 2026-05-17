import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
  communities as seedCommunities,
  events as seedEvents,
  initialComments,
  initialDrops,
  initialPosts,
  initialReports,
  lostFound as seedLostFound,
  students,
  studyGroups as seedStudyGroups,
  trends as seedTrends,
} from "../src/data";
import type { TheYepDatabase } from "./types";
import type { Community, DirectConversation, Post, PostComment } from "../src/types";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(serverDir, "data");
const sqlitePath = process.env.THEYEP_DATABASE_PATH ?? path.join(dataDir, "theyep.sqlite");
const legacyJsonPath = path.join(dataDir, "theyep-db.json");

mkdirSync(path.dirname(sqlitePath), { recursive: true });

const sqlite = new DatabaseSync(sqlitePath);
sqlite.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

function normalizeCampusName(value: unknown) {
  const campus = typeof value === "string" ? value.trim() : "";
  if (campus === "Campus Paralela" || campus === "Campus Tancredo Neves") return campus;
  if (/tancredo/i.test(campus)) return "Campus Tancredo Neves";
  return "Campus Paralela";
}

function normalizeStudentCampus<T extends { campus?: string }>(student: T): T {
  return {
    ...student,
    campus: normalizeCampusName(student.campus),
  };
}

function createSeedDatabase(): TheYepDatabase {
  return {
    profiles: {},
    posts: initialPosts,
    commentsByPost: initialComments,
    postReactions: {},
    drops: initialDrops,
    directConversations: [
      {
        id: "direct-serginho-lia",
        participants: [students[0], students[1]],
        updatedAt: "2026-05-13T13:14:00",
        unreadBy: ["serginho"],
        messages: [
          {
            id: "dm-1",
            author: students[1],
            body: "Vi o TheYep ficando vivo. Quando tiver beta, quero testar o Direct primeiro.",
            createdAt: "2026-05-13T13:10:00",
            time: "13:10",
          },
          {
            id: "dm-2",
            author: students[0],
            body: "Combinado. Vou deixar com energia de corredor de faculdade, mas sem virar bagunca.",
            createdAt: "2026-05-13T13:14:00",
            time: "13:14",
          },
        ],
      },
      {
        id: "direct-serginho-rafa",
        participants: [students[0], students[2]],
        updatedAt: "2026-05-13T12:22:00",
        unreadBy: [],
        messages: [
          {
            id: "dm-3",
            author: students[2],
            body: "Se rolar area de eventos, eu divulgo o ensaio aberto por la.",
            createdAt: "2026-05-13T12:22:00",
            time: "12:22",
          },
        ],
      },
    ],
    communities: seedCommunities,
    joinedCommunities: {
      serginho: [1, 2],
    },
    follows: {
      serginho: ["lia.codes", "rafanunes", "mayacosta"],
      "lia.codes": ["serginho", "rafanunes"],
      rafanunes: ["serginho", "lia.codes"],
      mayacosta: ["serginho"],
    },
    notifications: [],
    accounts: {},
    verificationCodes: {},
    events: seedEvents,
    eventVotes: {},
    rsvps: {
      serginho: [2],
    },
    studyGroups: seedStudyGroups,
    joinedGroups: {
      serginho: [1],
    },
    lostFound: seedLostFound,
    reports: initialReports,
    trends: seedTrends,
  };
}

function recordOrDefault<T>(value: unknown, fallback: Record<string, T>) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, T>)
    : fallback;
}

function normalizeDatabase(parsed: Partial<TheYepDatabase>): TheYepDatabase {
  const seeded = createSeedDatabase();
  const seededCommunities = new Map(seeded.communities.map((community) => [community.id, community]));
  const communityIdByName = new Map(seeded.communities.map((community) => [community.name, community.id]));
  const normalizeCommunity = (community: Community): Community => {
    const seededCommunity = seededCommunities.get(community.id) ?? seeded.communities[0];

    return {
      ...community,
      creator: normalizeStudentCampus(community.creator ?? seededCommunity.creator),
      createdAt: community.createdAt ?? seededCommunity.createdAt,
      campus: normalizeCampusName(community.campus ?? community.creator?.campus ?? seededCommunity.creator.campus),
    };
  };
  const normalizePost = (post: Post): Post => {
    const communityId = post.communityId ?? communityIdByName.get(post.community);
    const isCommunityPost = Boolean(communityId);

    return {
      ...post,
      author: normalizeStudentCampus(post.author),
      communityId,
      visibility: post.visibility ?? (isCommunityPost ? "both" : "main"),
      campus: normalizeCampusName(post.campus ?? post.author.campus),
      audience: post.audience ?? "general",
    };
  };
  const normalizeDirectConversation = (conversation: DirectConversation): DirectConversation => ({
    ...conversation,
    participants: conversation.participants.map(normalizeStudentCampus),
    messages: conversation.messages.map((message) => ({
      ...message,
      author: normalizeStudentCampus(message.author),
    })),
    lastMessage: conversation.lastMessage
      ? {
          ...conversation.lastMessage,
          author: normalizeStudentCampus(conversation.lastMessage.author),
        }
      : undefined,
    isGroup: conversation.isGroup ?? conversation.participants.length > 2,
    kind: conversation.kind ?? "social",
  });
  const normalizeLostFound = (item: Partial<TheYepDatabase["lostFound"][number]>): TheYepDatabase["lostFound"][number] => {
    const fallbackContact = String(item.contact ?? "").replace(/^@/, "");
    const author =
      item.author ??
      students.find((student) => student.handle === fallbackContact) ??
      students[0];
    const normalizedAuthor = normalizeStudentCampus(author);

    return {
      id: typeof item.id === "number" ? item.id : Date.now(),
      status: item.status === "Lost" ? "Lost" : "Found",
      item: typeof item.item === "string" ? item.item : "Campus item",
      location: typeof item.location === "string" ? item.location : "Campus",
      contact: typeof item.contact === "string" ? item.contact : `@${normalizedAuthor.handle}`,
      author: normalizedAuthor,
      campus: normalizeCampusName(item.campus ?? normalizedAuthor.campus),
      createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
      image: typeof item.image === "string" ? item.image : undefined,
    };
  };
  const seedPostIds = new Set([1, 2, 3, 4]);
  const seedDropIds = new Set([1, 2, 3]);
  const seedCommunityIds = new Set([1, 2, 3, 4]);
  const seedEventIds = new Set([1, 2, 3, 4, 5, 6]);
  const seedLostFoundIds = new Set([1, 2, 3]);
  const seedReportIds = new Set([1, 2]);
  const seedDirectIds = new Set(["direct-serginho-lia", "direct-serginho-rafa"]);
  const shouldKeepNumericSeed = (id: number, seededIds: Set<number>) => !seededIds.has(id);
  const stripSeedFollows = (value: unknown) => {
    const current = recordOrDefault<string[]>(value, {});
    const seedFollows = recordOrDefault<string[]>(seeded.follows, {});

    return Object.fromEntries(
      Object.entries(current)
        .filter(([, targets]) => Array.isArray(targets))
        .filter(([handle, targets]) => {
          const seedTargets = seedFollows[handle];
          return !seedTargets || seedTargets.slice().sort().join("|") !== targets.slice().sort().join("|");
        }),
    );
  };
  const normalizedPosts = Array.isArray(parsed.posts)
    ? (parsed.posts as Post[]).filter((post) => shouldKeepNumericSeed(post.id, seedPostIds)).map(normalizePost)
    : [];
  const normalizedPostIds = new Set(normalizedPosts.map((post) => post.id));
  const normalizedComments = Object.fromEntries(
    Object.entries(recordOrDefault<PostComment[]>(parsed.commentsByPost, {})).filter(([postId]) =>
      normalizedPostIds.has(Number(postId)),
    ),
  );
  const normalizedDrops = Array.isArray(parsed.drops)
    ? parsed.drops
        .filter((drop) => shouldKeepNumericSeed(drop.id, seedDropIds))
        .map((drop) => ({
          ...drop,
          author: normalizeStudentCampus(drop.author),
          campus: normalizeCampusName(drop.campus ?? drop.author.campus),
          audience: drop.audience ?? "campus",
        }))
    : [];
  const normalizedCommunities = Array.isArray(parsed.communities)
    ? (parsed.communities as Community[])
        .filter((community) => shouldKeepNumericSeed(community.id, seedCommunityIds))
        .map(normalizeCommunity)
    : [];
  const normalizedCommunityIds = new Set(normalizedCommunities.map((community) => community.id));
  const normalizedJoinedCommunities = Object.fromEntries(
    Object.entries(recordOrDefault<number[]>(parsed.joinedCommunities, {}))
      .map(([handle, communityIds]) => [
        handle,
        Array.isArray(communityIds)
          ? communityIds.filter((communityId) => normalizedCommunityIds.has(communityId))
          : [],
      ])
      .filter(([, communityIds]) => communityIds.length > 0),
  );
  const normalizedEvents = Array.isArray(parsed.events)
    ? parsed.events
        .filter((event) => shouldKeepNumericSeed(event.id, seedEventIds))
        .map((event) => ({
          ...event,
          author: normalizeStudentCampus(event.author),
          campus: normalizeCampusName(event.campus ?? event.author.campus),
        }))
    : [];
  const normalizedEventIds = new Set(normalizedEvents.map((event) => event.id));
  const normalizedRsvps = Object.fromEntries(
    Object.entries(recordOrDefault<number[]>(parsed.rsvps, {}))
      .map(([handle, eventIds]) => [
        handle,
        Array.isArray(eventIds) ? eventIds.filter((eventId) => normalizedEventIds.has(eventId)) : [],
      ])
      .filter(([, eventIds]) => eventIds.length > 0),
  );
  const normalizedLostFound = Array.isArray(parsed.lostFound)
    ? parsed.lostFound.filter((item) => shouldKeepNumericSeed(item.id, seedLostFoundIds)).map(normalizeLostFound)
    : [];
  const normalizedReports = Array.isArray(parsed.reports)
    ? parsed.reports.filter((report) => shouldKeepNumericSeed(report.id, seedReportIds))
    : [];
  const normalizedTrends =
    normalizedPosts.length || normalizedDrops.length
      ? Array.isArray(parsed.trends)
        ? parsed.trends
        : []
      : [];

  return {
    profiles: Object.fromEntries(
      Object.entries(recordOrDefault(parsed.profiles, seeded.profiles)).map(([handle, profile]) => [
        handle,
        profile && typeof profile === "object" && !Array.isArray(profile)
          ? { ...profile, campus: normalizeCampusName((profile as { campus?: string }).campus) }
          : profile,
      ]),
    ),
    posts: normalizedPosts,
    commentsByPost: normalizedComments,
    postReactions: recordOrDefault(parsed.postReactions, seeded.postReactions),
    drops: normalizedDrops,
    directConversations: Array.isArray(parsed.directConversations)
      ? (parsed.directConversations as DirectConversation[])
          .filter((conversation) => !seedDirectIds.has(conversation.id))
          .map(normalizeDirectConversation)
      : [],
    communities: normalizedCommunities,
    joinedCommunities: normalizedJoinedCommunities,
    events: normalizedEvents,
    eventVotes: recordOrDefault(parsed.eventVotes, seeded.eventVotes),
    rsvps: normalizedRsvps,
    studyGroups: [],
    joinedGroups: {},
    lostFound: normalizedLostFound,
    reports: normalizedReports,
    trends: normalizedTrends,
    follows: stripSeedFollows(parsed.follows),
    notifications: Array.isArray(parsed.notifications) ? parsed.notifications : seeded.notifications,
    accounts: Object.fromEntries(
      Object.entries(recordOrDefault(parsed.accounts, seeded.accounts)).map(([email, account]) => [
        email,
        {
          ...account,
          profile: normalizeStudentCampus(account.profile),
        },
      ]),
    ),
    verificationCodes: recordOrDefault(parsed.verificationCodes, seeded.verificationCodes),
  };
}

function readLegacyJson(): Partial<TheYepDatabase> | null {
  if (!existsSync(legacyJsonPath)) return null;

  try {
    return JSON.parse(readFileSync(legacyJsonPath, "utf8")) as Partial<TheYepDatabase>;
  } catch {
    return null;
  }
}

function readStateRow() {
  return sqlite
    .prepare("SELECT value FROM app_state WHERE key = ?")
    .get("database") as { value: string } | undefined;
}

function writeStateRow(database: TheYepDatabase) {
  sqlite
    .prepare(
      `
        INSERT INTO app_state (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `,
    )
    .run("database", JSON.stringify(database), new Date().toISOString());
}

function ensureSeeded() {
  if (readStateRow()) return;
  writeStateRow(normalizeDatabase(readLegacyJson() ?? createSeedDatabase()));
}

ensureSeeded();

export async function readDatabase(): Promise<TheYepDatabase> {
  const row = readStateRow();
  if (!row) {
    const seeded = createSeedDatabase();
    writeStateRow(seeded);
    return seeded;
  }

  return normalizeDatabase(JSON.parse(row.value) as Partial<TheYepDatabase>);
}

export async function updateDatabase<T>(updater: (database: TheYepDatabase) => T | Promise<T>) {
  const database = await readDatabase();
  const result = await updater(database);

  sqlite.exec("BEGIN IMMEDIATE");
  try {
    writeStateRow(database);
    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }

  return result;
}
