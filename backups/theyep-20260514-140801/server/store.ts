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
import type { Community, DirectConversation, Post } from "../src/types";

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
      creator: community.creator ?? seededCommunity.creator,
      createdAt: community.createdAt ?? seededCommunity.createdAt,
    };
  };
  const normalizePost = (post: Post): Post => {
    const communityId = post.communityId ?? communityIdByName.get(post.community);
    const isCommunityPost = Boolean(communityId);

    return {
      ...post,
      communityId,
      visibility: post.visibility ?? (isCommunityPost ? "both" : "main"),
    };
  };
  const normalizeDirectConversation = (conversation: DirectConversation): DirectConversation => ({
    ...conversation,
    isGroup: conversation.isGroup ?? conversation.participants.length > 2,
    kind: conversation.kind ?? "social",
  });
  const normalizeLostFound = (item: Partial<TheYepDatabase["lostFound"][number]>): TheYepDatabase["lostFound"][number] => {
    const fallbackContact = String(item.contact ?? "").replace(/^@/, "");
    const author =
      item.author ??
      students.find((student) => student.handle === fallbackContact) ??
      students[0];

    return {
      id: typeof item.id === "number" ? item.id : Date.now(),
      status: item.status === "Lost" ? "Lost" : "Found",
      item: typeof item.item === "string" ? item.item : "Campus item",
      location: typeof item.location === "string" ? item.location : "Campus",
      contact: typeof item.contact === "string" ? item.contact : `@${author.handle}`,
      author,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
      image: typeof item.image === "string" ? item.image : undefined,
    };
  };

  return {
    profiles: recordOrDefault(parsed.profiles, seeded.profiles),
    posts: Array.isArray(parsed.posts) ? (parsed.posts as Post[]).map(normalizePost) : seeded.posts,
    commentsByPost: recordOrDefault(parsed.commentsByPost, seeded.commentsByPost),
    postReactions: recordOrDefault(parsed.postReactions, seeded.postReactions),
    drops: Array.isArray(parsed.drops) ? parsed.drops : seeded.drops,
    directConversations: Array.isArray(parsed.directConversations)
      ? (parsed.directConversations as DirectConversation[]).map(normalizeDirectConversation)
      : seeded.directConversations,
    communities: Array.isArray(parsed.communities)
      ? (parsed.communities as Community[]).map(normalizeCommunity)
      : seeded.communities,
    joinedCommunities: recordOrDefault(parsed.joinedCommunities, seeded.joinedCommunities),
    events: Array.isArray(parsed.events) ? parsed.events : seeded.events,
    eventVotes: recordOrDefault(parsed.eventVotes, seeded.eventVotes),
    rsvps: recordOrDefault(parsed.rsvps, seeded.rsvps),
    studyGroups: Array.isArray(parsed.studyGroups) ? parsed.studyGroups : seeded.studyGroups,
    joinedGroups: recordOrDefault(parsed.joinedGroups, seeded.joinedGroups),
    lostFound: Array.isArray(parsed.lostFound) ? parsed.lostFound.map(normalizeLostFound) : seeded.lostFound,
    reports: Array.isArray(parsed.reports) ? parsed.reports : seeded.reports,
    trends: Array.isArray(parsed.trends) ? parsed.trends : seeded.trends,
    follows: recordOrDefault(parsed.follows, seeded.follows),
    notifications: Array.isArray(parsed.notifications) ? parsed.notifications : seeded.notifications,
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
