import http from "node:http";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { appendFile, mkdir, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import { pbkdf2Sync, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import nodePath from "node:path";
import { URL } from "node:url";
import { fileURLToPath } from "node:url";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import Busboy from "busboy";
import nodemailer from "nodemailer";
import type {
  CampusEvent,
  Community,
  DirectConversation,
  DirectMessage,
  DirectMessageWindow,
  LostFound,
  Notification,
  Post,
  PostComment,
  PostVisibility,
  ReactionKey,
  Report,
  Student,
  Trend,
  UserAccount,
} from "../src/types";
import {
  EVENT_EDIT_LIMIT,
  EVENT_FALSE_BLOCK_THRESHOLD,
  EVENT_WEEKLY_LIMIT,
  buildEventAuthorStats,
  formatEventDate,
  getEventPostingStatus,
  isEventPast,
} from "./eventRules";
import { readDatabase, updateDatabase } from "./store";
import type {
  EventCreatePayload,
  EventUpdatePayload,
  EventVoteChoice,
  EventVotePayload,
  TheYepDatabase,
} from "./types";

const port = Number(process.env.PORT ?? 4100);
const host = process.env.HOST ?? "127.0.0.1";
const allowedOrigin = process.env.THEYEP_ALLOWED_ORIGINS?.split(",")[0]?.trim() || "*";
const rateLimitPerMinute = Number(process.env.THEYEP_RATE_LIMIT_PER_MINUTE ?? 240);
const serveFrontend = process.env.THEYEP_SERVE_FRONTEND !== "false";
const serverDir = nodePath.dirname(fileURLToPath(import.meta.url));
const projectRoot = nodePath.resolve(serverDir, "..");
const distDir = nodePath.join(projectRoot, "dist");
const uploadsDir = nodePath.join(serverDir, "uploads");
const chunkUploadsDir = nodePath.join(uploadsDir, ".chunks");
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const uploadLimits = {
  image: Number(process.env.THEYEP_IMAGE_UPLOAD_LIMIT_BYTES ?? 8 * 1024 * 1024),
  video: Number(process.env.THEYEP_VIDEO_UPLOAD_LIMIT_BYTES ?? 500 * 1024 * 1024),
};
const chunkUploadSize = Number(process.env.THEYEP_VIDEO_UPLOAD_CHUNK_BYTES ?? 8 * 1024 * 1024);
const r2Config = {
  accountId: process.env.CLOUDFLARE_R2_ACCOUNT_ID ?? "",
  accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? "",
  secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? "",
  bucket: process.env.CLOUDFLARE_R2_BUCKET_VIDEOS ?? "theyep-videos",
  publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL ?? "",
};
const directMessagePageSize = Number(process.env.THEYEP_DIRECT_MESSAGE_PAGE_SIZE ?? 24);
const campusOptions = ["Campus Paralela", "Campus Tancredo Neves"] as const;
const authCodeMinutes = Number(process.env.THEYEP_AUTH_CODE_MINUTES ?? 12);
const emailFrom = process.env.THEYEP_EMAIL_FROM ?? "theyep.team@gmail.com";
const smtpHost = process.env.THEYEP_SMTP_HOST ?? "smtp.gmail.com";
const smtpPort = Number(process.env.THEYEP_SMTP_PORT ?? 587);
const smtpUser = process.env.THEYEP_SMTP_USER ?? emailFrom;
const smtpPass = process.env.THEYEP_SMTP_PASS ?? "";
const adminHandles = new Set(
  (process.env.THEYEP_ADMIN_HANDLES ?? "theyep.owner,theyep.admin")
    .split(",")
    .map((handle) => handle.trim().replace(/^@/, ""))
    .filter(Boolean),
);

type ApiError = {
  status: number;
  message: string;
};

type PostCreatePayload = {
  author: Student;
  body: string;
  mood: string;
  image?: string;
  video?: string;
  communityId?: number;
  audience: "general" | "campus";
  visibility: PostVisibility;
};

type CommunityCreatePayload = {
  author: Student;
  name: string;
  category: string;
  description: string;
  accent: string;
  avatar?: string;
};

type CommentPayload = {
  author: Student;
  body: string;
};

type DropCreatePayload = CommentPayload & {
  image?: string;
};

type HandlePayload = {
  handle: string;
};

type ReportPayload = {
  target: string;
  reason: string;
};

type DirectStartPayload = {
  author: Student;
  recipientHandles: string[];
  body: string;
  image?: string;
  title?: string;
  isGroup: boolean;
  avatar?: string;
};

type DirectMessagePayload = {
  author: Student;
  body: string;
  image?: string;
};

type AuthRegisterPayload = {
  email: string;
  password: string;
  code: string;
  firstName: string;
  lastName: string;
  handle: string;
  campus: string;
  language: "pt-BR" | "en";
};

type AuthLoginPayload = {
  emailOrHandle: string;
  password: string;
};

type R2PresignPayload = {
  filename: string;
  contentType: string;
  size: number;
};

let r2Client: S3Client | null = null;

type ChunkUploadSession = {
  uploadId: string;
  filename: string;
  contentType: string;
  extension: string;
  size: number;
  chunkSize: number;
  totalChunks: number;
  receivedChunks: Set<number>;
  receivedBytes: number;
  createdAt: number;
};

const chunkUploadSessions = new Map<string, ChunkUploadSession>();

type LostFoundCreatePayload = {
  author: Student;
  status: "Lost" | "Found";
  item: string;
  location: string;
  image?: string;
};

function createError(status: number, message: string): ApiError {
  return { status, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readLanguage(value: unknown): "pt-BR" | "en" {
  return value === "en" ? "en" : "pt-BR";
}

function readCampus(value: unknown) {
  const campus = readString(value);
  if (!campusOptions.includes(campus as (typeof campusOptions)[number])) {
    throw createError(400, "Choose Campus Paralela or Campus Tancredo Neves.");
  }
  return campus;
}

function normalizeCampusName(value: unknown) {
  const campus = readString(value);
  if (campusOptions.includes(campus as (typeof campusOptions)[number])) return campus;
  if (/tancredo/i.test(campus)) return "Campus Tancredo Neves";
  return "Campus Paralela";
}

function normalizeAuthEmail(value: unknown) {
  return readString(value).toLowerCase();
}

function isValidAuthEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email) && email.length <= 254;
}

function normalizeUserHandle(value: unknown) {
  return readString(value)
    .replace(/^@/, "")
    .toLowerCase();
}

function isValidUserHandle(handle: string) {
  return /^[a-z0-9._-]{3,24}$/.test(handle);
}

function readStudent(value: unknown): Student | null {
  if (!isRecord(value)) return null;

  const student = {
    name: readString(value.name),
    handle: readString(value.handle).replace(/^@/, ""),
    course: readString(value.course),
    semester: readString(value.semester),
    campus: normalizeCampusName(value.campus),
    avatar: readString(value.avatar).slice(0, 3).toUpperCase(),
    photo: readString(value.photo) || undefined,
  };

  return student.name && student.handle && student.campus ? student : null;
}

function readHandle(value: unknown): string {
  if (!isRecord(value)) return "";
  return readString(value.handle ?? value.authorHandle).replace(/^@/, "");
}

function readHandlePayload(body: unknown): HandlePayload {
  const handle = readHandle(body);
  if (!handle) {
    throw createError(400, "Missing user handle.");
  }
  return { handle };
}

function readCreatePayload(body: unknown): EventCreatePayload {
  if (!isRecord(body)) {
    throw createError(400, "Invalid event payload.");
  }

  const author = readStudent(body.author);
  const payload = {
    title: readString(body.title),
    category: readString(body.category),
    location: readString(body.location),
    startsAt: readString(body.startsAt),
    author,
  };

  if (!payload.title || !payload.category || !payload.location || !payload.startsAt || !author) {
    throw createError(400, "Missing title, category, location, date, or author.");
  }

  return { ...payload, author };
}

function readUpdatePayload(body: unknown): EventUpdatePayload {
  if (!isRecord(body)) {
    throw createError(400, "Invalid event update payload.");
  }

  const payload = {
    title: readString(body.title),
    category: readString(body.category),
    location: readString(body.location),
    startsAt: readString(body.startsAt),
    authorHandle: readString(body.authorHandle).replace(/^@/, ""),
  };

  if (!payload.title || !payload.category || !payload.location || !payload.startsAt || !payload.authorHandle) {
    throw createError(400, "Missing title, category, location, date, or author handle.");
  }

  return payload;
}

function readVotePayload(body: unknown): EventVotePayload {
  if (!isRecord(body)) {
    throw createError(400, "Invalid event vote payload.");
  }

  const authorHandle = readString(body.authorHandle).replace(/^@/, "");
  const choice = body.choice;

  if (!authorHandle || (choice !== "true" && choice !== "false")) {
    throw createError(400, "Missing voter handle or vote choice.");
  }

  return { authorHandle, choice };
}

function readPostCreatePayload(body: unknown): PostCreatePayload {
  if (!isRecord(body)) {
    throw createError(400, "Invalid post payload.");
  }

  const author = readStudent(body.author);
  const visibility: PostVisibility =
    body.visibility === "community" || body.visibility === "both" || body.visibility === "main"
      ? body.visibility
      : "main";
  const audience: PostCreatePayload["audience"] = body.audience === "general" ? "general" : "campus";
  const payload = {
    author,
    body: readString(body.body),
    mood: readString(body.mood),
    image: readString(body.image) || undefined,
    video: readString(body.video) || undefined,
    communityId: typeof body.communityId === "number" ? body.communityId : undefined,
    audience,
    visibility,
  };

  if (!author || !payload.body || !payload.mood) {
    throw createError(400, "Missing author, post body, or mood.");
  }

  return { ...payload, author };
}

function readCommunityCreatePayload(body: unknown): CommunityCreatePayload {
  if (!isRecord(body)) {
    throw createError(400, "Invalid community payload.");
  }

  const author = readStudent(body.author);
  const payload = {
    author,
    name: readString(body.name).slice(0, 42),
    category: readString(body.category).slice(0, 28),
    description: readString(body.description).slice(0, 180),
    accent: readString(body.accent) || "#00b8d9",
    avatar: readString(body.avatar) || undefined,
  };

  if (!author || !payload.name || !payload.category || !payload.description) {
    throw createError(400, "Missing creator, name, category, or description.");
  }

  return { ...payload, author };
}

function readCommentPayload(body: unknown): CommentPayload {
  if (!isRecord(body)) {
    throw createError(400, "Invalid comment payload.");
  }

  const author = readStudent(body.author);
  const payload = {
    author,
    body: readString(body.body),
  };

  if (!author || !payload.body) {
    throw createError(400, "Missing author or comment body.");
  }

  return { ...payload, author };
}

function readDropCreatePayload(body: unknown): DropCreatePayload {
  const payload = readCommentPayload(body);
  const image = isRecord(body) ? readString(body.image) : "";

  return {
    ...payload,
    image: image || undefined,
  };
}

function readDirectStartPayload(body: unknown): DirectStartPayload {
  if (!isRecord(body)) {
    throw createError(400, "Invalid direct payload.");
  }

  const author = readStudent(body.author);
  const rawHandles = Array.isArray(body.recipientHandles)
    ? body.recipientHandles
    : [body.recipientHandle];
  const recipientHandles = [
    ...new Set(
      rawHandles
        .map((handle) => readString(handle).replace(/^@/, ""))
        .filter(Boolean),
    ),
  ];
  const payload = {
    author,
    recipientHandles,
    body: readString(body.body),
    image: readString(body.image) || undefined,
    title: readString(body.title).slice(0, 42) || undefined,
    isGroup: Boolean(body.isGroup) || recipientHandles.length > 1,
    avatar: readString(body.avatar) || undefined,
  };

  if (!author || payload.recipientHandles.length === 0 || (!payload.body && !payload.image)) {
    throw createError(400, "Missing sender, recipient, or message.");
  }

  if (payload.recipientHandles.includes(author.handle)) {
    throw createError(400, "You cannot start a direct with yourself.");
  }

  return { ...payload, author };
}

function readDirectMessagePayload(body: unknown): DirectMessagePayload {
  if (!isRecord(body)) {
    throw createError(400, "Invalid direct payload.");
  }

  const author = readStudent(body.author);
  const payload = {
    author,
    body: readString(body.body),
    image: readString(body.image) || undefined,
  };

  if (!author || (!payload.body && !payload.image)) {
    throw createError(400, "Missing sender or message.");
  }

  return { ...payload, author };
}

function readAuthRegisterPayload(body: unknown): AuthRegisterPayload {
  if (!isRecord(body)) throw createError(400, "Invalid account payload.");
  const email = normalizeAuthEmail(body.email);
  const handle = normalizeUserHandle(body.handle);
  const password = readString(body.password);
  const payload = {
    email,
    password,
    code: readString(body.code),
    firstName: readString(body.firstName).slice(0, 40),
    lastName: readString(body.lastName).slice(0, 60),
    handle,
    campus: readCampus(body.campus),
    language: readLanguage(body.language),
  };

  if (!isValidAuthEmail(email)) {
    throw createError(400, "Use a valid email address.");
  }
  if (!isValidUserHandle(handle)) {
    throw createError(400, "Handles can use letters, numbers, '.', '_' and '-' only.");
  }
  if (password.length < 8) {
    throw createError(400, "Password needs at least 8 characters.");
  }
  if (!payload.code || !payload.firstName || !payload.lastName) {
    throw createError(400, "Missing name, handle, code, or password.");
  }

  return payload;
}

function readAuthLoginPayload(body: unknown): AuthLoginPayload {
  if (!isRecord(body)) throw createError(400, "Invalid login payload.");
  const payload = {
    emailOrHandle: readString(body.emailOrHandle).toLowerCase().replace(/^@/, ""),
    password: readString(body.password),
  };
  if (!payload.emailOrHandle || !payload.password) {
    throw createError(400, "Missing login or password.");
  }
  return payload;
}

function readLostFoundCreatePayload(body: unknown): LostFoundCreatePayload {
  if (!isRecord(body)) {
    throw createError(400, "Invalid lost and found payload.");
  }

  const author = readStudent(body.author);
  const status: LostFoundCreatePayload["status"] = body.status === "Lost" ? "Lost" : "Found";
  const payload = {
    author,
    status,
    item: readString(body.item).slice(0, 80),
    location: readString(body.location).slice(0, 100),
    image: readString(body.image) || undefined,
  };

  if (!author || !payload.item || !payload.location) {
    throw createError(400, "Missing author, item, or location.");
  }

  return { ...payload, author };
}

function readReportPayload(body: unknown): ReportPayload {
  if (!isRecord(body)) {
    throw createError(400, "Invalid report payload.");
  }

  const payload = {
    target: readString(body.target),
    reason: readString(body.reason),
  };

  if (!payload.target || !payload.reason) {
    throw createError(400, "Missing report target or reason.");
  }

  return payload;
}

async function readJsonBody(request: http.IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function readBinaryBody(request: http.IncomingMessage, maxBytes: number) {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBytes) {
      throw createError(413, "Upload chunk is too large.");
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks, totalBytes);
}

function extensionForUpload(contentType: string, filename: string) {
  const mimeExtensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  const fromMime = mimeExtensions[contentType.toLowerCase()];
  if (fromMime) return fromMime;

  const fromName = nodePath.extname(filename).replace(".", "").toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "mp4", "webm", "mov"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }

  return "";
}

function cleanupExpiredChunkUploads() {
  const maxAgeMs = 2 * 60 * 60 * 1000;
  const now = Date.now();
  for (const [uploadId, session] of chunkUploadSessions.entries()) {
    if (now - session.createdAt > maxAgeMs) {
      chunkUploadSessions.delete(uploadId);
      rm(nodePath.join(chunkUploadsDir, uploadId), { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

function readChunkUploadInitPayload(body: unknown) {
  if (!isRecord(body)) throw createError(400, "Invalid chunked upload payload.");

  const filename = readString(body.filename).slice(0, 180);
  const contentType = readString(body.contentType);
  const size = Number(body.size ?? 0);

  if (!filename || !contentType.startsWith("video/") || !Number.isFinite(size)) {
    throw createError(400, "Invalid video upload request.");
  }
  if (size <= 0 || size > uploadLimits.video) {
    throw createError(413, "Choose a video up to 500 MB.");
  }

  const extension = extensionForUpload(contentType, filename);
  if (!extension || !["mp4", "webm", "mov"].includes(extension)) {
    throw createError(415, "Unsupported video file type.");
  }

  return { filename, contentType, size, extension };
}

async function createChunkUploadSession(body: unknown) {
  cleanupExpiredChunkUploads();
  const payload = readChunkUploadInitPayload(body);
  const uploadId = randomUUID();
  const chunkSize = Math.max(1024 * 1024, Math.min(chunkUploadSize, 32 * 1024 * 1024));
  const totalChunks = Math.ceil(payload.size / chunkSize);
  const session: ChunkUploadSession = {
    uploadId,
    ...payload,
    chunkSize,
    totalChunks,
    receivedChunks: new Set(),
    receivedBytes: 0,
    createdAt: Date.now(),
  };

  chunkUploadSessions.set(uploadId, session);
  await mkdir(nodePath.join(chunkUploadsDir, uploadId), { recursive: true });

  return {
    uploadId,
    chunkSize,
    totalChunks,
    maxSize: uploadLimits.video,
  };
}

function readChunkSession(uploadId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(uploadId)) {
    throw createError(404, "Upload session not found.");
  }

  const session = chunkUploadSessions.get(uploadId);
  if (!session) {
    throw createError(404, "Upload session expired. Please choose the video again.");
  }
  return session;
}

function chunkFilePath(uploadId: string, index: number) {
  return nodePath.join(chunkUploadsDir, uploadId, `${index}.part`);
}

async function receiveUploadChunk(uploadId: string, chunkIndex: number, request: http.IncomingMessage) {
  const session = readChunkSession(uploadId);
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= session.totalChunks) {
    throw createError(400, "Invalid upload chunk.");
  }

  const expectedSize =
    chunkIndex === session.totalChunks - 1 ? session.size - session.chunkSize * chunkIndex : session.chunkSize;
  const chunk = await readBinaryBody(request, session.chunkSize + 1024);
  if (chunk.length !== expectedSize) {
    throw createError(400, "Upload chunk size does not match this video.");
  }

  const wasReceived = session.receivedChunks.has(chunkIndex);
  await writeFile(chunkFilePath(uploadId, chunkIndex), chunk);
  if (!wasReceived) {
    session.receivedChunks.add(chunkIndex);
    session.receivedBytes += chunk.length;
  }

  return {
    uploadId,
    received: session.receivedChunks.size,
    totalChunks: session.totalChunks,
  };
}

async function completeChunkUpload(uploadId: string) {
  const session = readChunkSession(uploadId);
  if (session.receivedChunks.size !== session.totalChunks || session.receivedBytes !== session.size) {
    throw createError(409, "Video upload is not complete yet.");
  }

  await mkdir(uploadsDir, { recursive: true });
  const storedName = `${Date.now()}-${randomUUID()}.${session.extension}`;
  const storedPath = nodePath.join(uploadsDir, storedName);

  try {
    await writeFile(storedPath, Buffer.alloc(0));
    for (let index = 0; index < session.totalChunks; index += 1) {
      const path = chunkFilePath(uploadId, index);
      if (!existsSync(path)) {
        throw createError(409, "Video upload is missing a chunk.");
      }
      await appendFile(storedPath, await readFile(path));
    }

    const fileStats = await stat(storedPath);
    if (fileStats.size !== session.size) {
      throw createError(500, "Could not assemble this video upload.");
    }

    chunkUploadSessions.delete(uploadId);
    await rm(nodePath.join(chunkUploadsDir, uploadId), { recursive: true, force: true });

    return {
      url: `/api/uploads/${storedName}`,
      filename: session.filename,
      contentType: session.contentType,
      size: fileStats.size,
    };
  } catch (error) {
    await unlink(storedPath).catch(() => undefined);
    throw error;
  }
}

function readR2PresignPayload(body: unknown): R2PresignPayload {
  if (!isRecord(body)) throw createError(400, "Invalid R2 upload payload.");

  const payload = {
    filename: readString(body.filename).slice(0, 180),
    contentType: readString(body.contentType),
    size: Number(body.size ?? 0),
  };

  if (!payload.filename || !payload.contentType.startsWith("video/") || !Number.isFinite(payload.size)) {
    throw createError(400, "Invalid video upload request.");
  }

  if (payload.size <= 0 || payload.size > uploadLimits.video) {
    throw createError(413, "Video upload is too large.");
  }

  const extension = extensionForUpload(payload.contentType, payload.filename);
  if (!extension || !["mp4", "webm", "mov"].includes(extension)) {
    throw createError(415, "Unsupported video file type.");
  }

  return payload;
}

function isR2Configured() {
  return Boolean(
    r2Config.accountId &&
      r2Config.accessKeyId &&
      r2Config.secretAccessKey &&
      r2Config.bucket &&
      r2Config.publicUrl,
  );
}

function getR2Client() {
  if (!isR2Configured()) {
    throw createError(503, "R2 video storage is not configured yet. Videos under 100 MB still work on the public site.");
  }

  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2Config.accessKeyId,
        secretAccessKey: r2Config.secretAccessKey,
      },
    });
  }

  return r2Client;
}

async function createR2PresignedUpload(body: unknown) {
  const payload = readR2PresignPayload(body);
  const extension = extensionForUpload(payload.contentType, payload.filename);
  const key = `videos/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
  const expiresIn = 15 * 60;
  const uploadUrl = await getSignedUrl(
    getR2Client(),
    new PutObjectCommand({
      Bucket: r2Config.bucket,
      Key: key,
      ContentType: payload.contentType,
    }),
    { expiresIn },
  );

  return {
    key,
    uploadUrl,
    publicUrl: `${r2Config.publicUrl.replace(/\/+$/, "")}/${key}`,
    expiresIn,
  };
}

async function createUpload(request: http.IncomingMessage) {
  const contentType = request.headers["content-type"]?.toString() ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw createError(400, "Uploads must use multipart/form-data.");
  }

  await mkdir(uploadsDir, { recursive: true });

  return new Promise<{
    url: string;
    filename: string;
    contentType: string;
    size: number;
  }>((resolve, reject) => {
    let settled = false;
    let uploadResult:
      | {
          url: string;
          filename: string;
          contentType: string;
          size: number;
        }
      | null = null;
    const writeTasks: Promise<void>[] = [];
    const busboy = Busboy({
      headers: request.headers,
      limits: {
        fileSize: uploadLimits.video,
        files: 1,
      },
    });

    const rejectOnce = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    busboy.on("file", (fieldName, file, info) => {
      if (fieldName !== "file" || uploadResult) {
        file.resume();
        return;
      }

      const contentType = info.mimeType || "application/octet-stream";
      const kind = contentType.startsWith("image/")
        ? "image"
        : contentType.startsWith("video/")
          ? "video"
          : "";
      if (!kind) {
        file.resume();
        rejectOnce(createError(415, "Only image and video uploads are supported."));
        return;
      }

      const extension = extensionForUpload(contentType, info.filename);
      if (!extension) {
        file.resume();
        rejectOnce(createError(415, "Unsupported media file type."));
        return;
      }

      const maxBytes = kind === "image" ? uploadLimits.image : uploadLimits.video;
      const storedName = `${Date.now()}-${randomUUID()}.${extension}`;
      const storedPath = nodePath.join(uploadsDir, storedName);
      const writeStream = createWriteStream(storedPath);
      let uploadedBytes = 0;
      let fileRejected = false;

      const rejectFile = (error: ApiError) => {
        if (fileRejected) return;
        fileRejected = true;
        file.unpipe(writeStream);
        writeStream.destroy();
        file.resume();
        unlink(storedPath).catch(() => undefined);
        rejectOnce(error);
      };

      file.on("data", (chunk: Buffer) => {
        uploadedBytes += chunk.length;
        if (uploadedBytes > maxBytes) {
          rejectFile(createError(413, `${kind === "image" ? "Image" : "Video"} upload is too large.`));
        }
      });

      file.on("limit", () => {
        rejectFile(createError(413, `${kind === "image" ? "Image" : "Video"} upload is too large.`));
      });

      const writeTask = new Promise<void>((resolveWrite, rejectWrite) => {
        writeStream.on("finish", () => {
          if (!fileRejected) {
            uploadResult = {
              url: `/api/uploads/${storedName}`,
              filename: info.filename,
              contentType,
              size: uploadedBytes,
            };
          }
          resolveWrite();
        });
        writeStream.on("error", rejectWrite);
        file.on("error", rejectWrite);
      });
      writeTasks.push(writeTask);
      file.pipe(writeStream);
    });

    busboy.on("error", rejectOnce);
    busboy.on("finish", () => {
      Promise.all(writeTasks)
        .then(() => {
          if (settled) return;
          if (!uploadResult) {
            rejectOnce(createError(400, "Missing uploaded file."));
            return;
          }
          settled = true;
          resolve(uploadResult);
        })
        .catch(rejectOnce);
    });

    request.pipe(busboy);
  });
}

function sendJson(response: http.ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  });
  response.end(JSON.stringify(body));
}

function sendNoContent(response: http.ServerResponse) {
  response.writeHead(204, {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Vary": "Origin",
  });
  response.end();
}

function getClientKey(request: http.IncomingMessage) {
  return (
    request.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    request.socket.remoteAddress ||
    "unknown"
  );
}

function isRateLimited(request: http.IncomingMessage) {
  if (rateLimitPerMinute <= 0) return false;

  const key = getClientKey(request);
  const now = Date.now();
  const bucket = rateBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }

  bucket.count += 1;
  return bucket.count > rateLimitPerMinute;
}

function contentTypeFor(filePath: string) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".gif")) return "image/gif";
  if (filePath.endsWith(".webp")) return "image/webp";
  if (filePath.endsWith(".mp4")) return "video/mp4";
  if (filePath.endsWith(".webm")) return "video/webm";
  if (filePath.endsWith(".mov")) return "video/quicktime";
  return "application/octet-stream";
}

function parseRangeHeader(rangeHeader: string | undefined, fileSize: number) {
  if (!rangeHeader) return null;

  const range = rangeHeader.split(",")[0]?.trim().match(/^bytes=(\d*)-(\d*)$/);
  if (!range) return "invalid" as const;

  const [, rawStart, rawEnd] = range;
  if (!rawStart && !rawEnd) return "invalid" as const;

  let start: number;
  let end: number;

  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return "invalid" as const;
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : fileSize - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= fileSize || end < start) {
    return "invalid" as const;
  }

  return {
    start,
    end: Math.min(end, fileSize - 1),
  };
}

async function serveUploadedMedia(filename: string, request: http.IncomingMessage, response: http.ServerResponse) {
  const decodedName = decodeURIComponent(filename);
  const safeName = nodePath.basename(decodedName);
  if (!safeName || safeName !== decodedName) {
    throw createError(404, "Upload not found.");
  }

  const filePath = nodePath.join(uploadsDir, safeName);
  const fileStats = existsSync(filePath) ? await stat(filePath) : null;
  if (!fileStats?.isFile()) {
    throw createError(404, "Upload not found.");
  }

  const contentType = contentTypeFor(filePath);
  const baseHeaders = {
    "Accept-Ranges": "bytes",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Type": contentType,
    "Vary": "Origin",
  };
  const range = parseRangeHeader(request.headers.range?.toString(), fileStats.size);

  if (range === "invalid") {
    response.writeHead(416, {
      ...baseHeaders,
      "Content-Range": `bytes */${fileStats.size}`,
      "Content-Length": "0",
    });
    response.end();
    return;
  }

  if (range) {
    const contentLength = range.end - range.start + 1;
    response.writeHead(206, {
      ...baseHeaders,
      "Content-Range": `bytes ${range.start}-${range.end}/${fileStats.size}`,
      "Content-Length": String(contentLength),
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(filePath, { start: range.start, end: range.end }).pipe(response);
    return;
  }

  response.writeHead(200, {
    ...baseHeaders,
    "Content-Length": String(fileStats.size),
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(filePath).pipe(response);
}

async function serveStatic(requestPath: string, response: http.ServerResponse) {
  if (!serveFrontend || !existsSync(distDir)) return false;

  const safePath = nodePath
    .normalize(decodeURIComponent(requestPath))
    .replace(/^(\.\.[/\\])+/, "")
    .replace(/^[/\\]/, "");
  const candidatePath = safePath ? nodePath.join(distDir, safePath) : nodePath.join(distDir, "index.html");
  const filePath = existsSync(candidatePath) && (await stat(candidatePath)).isFile()
    ? candidatePath
    : nodePath.join(distDir, "index.html");

  response.writeHead(200, {
    "Content-Type": contentTypeFor(filePath),
  });
  createReadStream(filePath).pipe(response);
  return true;
}

function countComments(comments: PostComment[]): number {
  return comments.reduce((total, comment) => total + 1 + countComments(comment.replies), 0);
}

function findCommentTarget(
  comments: PostComment[],
  commentId: string,
  rootId?: string,
  depth = 0,
): { comment: PostComment; rootId: string; depth: number } | null {
  for (const comment of comments) {
    const currentRootId = rootId ?? comment.id;
    if (comment.id === commentId) {
      return { comment, rootId: currentRootId, depth };
    }

    const nestedTarget = findCommentTarget(comment.replies, commentId, currentRootId, depth + 1);
    if (nestedTarget) return nestedTarget;
  }

  return null;
}

function addReplyToComment(comments: PostComment[], rootId: string, reply: PostComment): PostComment[] {
  return comments.map((comment) =>
    comment.id === rootId
      ? { ...comment, replies: [...comment.replies, reply] }
      : { ...comment, replies: addReplyToComment(comment.replies, rootId, reply) },
  );
}

function removeCommentFromTree(
  comments: PostComment[],
  commentId: string,
): { comments: PostComment[]; removed: boolean } {
  let removed = false;
  const nextComments = comments
    .filter((comment) => {
      if (comment.id === commentId) {
        removed = true;
        return false;
      }
      return true;
    })
    .map((comment) => {
      const result = removeCommentFromTree(comment.replies, commentId);
      if (result.removed) removed = true;
      return { ...comment, replies: result.comments };
    });

  return { comments: nextComments, removed };
}

function flattenCommentText(comments: PostComment[]): string {
  return comments.map((comment) => `${comment.body} ${flattenCommentText(comment.replies)}`).join(" ");
}

function extractTags(value: string) {
  return value.match(/#[\w]+/g) ?? [];
}

function isAdminHandle(handle: string) {
  return adminHandles.has(handle);
}

function canModerateAs(handle: string) {
  return isAdminHandle(handle);
}

function normalizeHandle(handle: string) {
  return handle.trim().replace(/^@/, "");
}

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const passwordHash = pbkdf2Sync(password, salt, 120_000, 32, "sha256").toString("hex");
  return { passwordHash, passwordSalt: salt };
}

function verifyPassword(password: string, account: UserAccount) {
  const candidate = Buffer.from(hashPassword(password, account.passwordSalt).passwordHash, "hex");
  const stored = Buffer.from(account.passwordHash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

async function sendVerificationEmail(email: string, code: string) {
  const subject = "Seu codigo TheYep";
  const text = [
    `Seu codigo TheYep e ${code}.`,
    `Ele expira em ${authCodeMinutes} minutos.`,
    "",
    "Se voce nao pediu esse codigo, pode ignorar este e-mail.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#17151f">
      <h1 style="margin:0 0 12px;color:#ff0a83">TheYep</h1>
      <p>Seu codigo de confirmacao e:</p>
      <p style="font-size:28px;font-weight:800;letter-spacing:4px;margin:12px 0">${code}</p>
      <p>Ele expira em ${authCodeMinutes} minutos.</p>
      <p style="color:#666">Se voce nao pediu esse codigo, pode ignorar este e-mail.</p>
    </div>
  `;

  if (!smtpPass) {
    console.log(`[TheYep auth] Verification code for ${email}: ${code}`);
    return { sent: false, devCode: code };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  await transporter.sendMail({
    from: `"TheYep" <${emailFrom}>`,
    to: email,
    subject,
    text,
    html,
  });

  console.log(`[TheYep auth] Verification email sent to ${email}.`);
  return { sent: true };
}

function formatDirectTime(date = new Date()) {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getKnownStudents(database: TheYepDatabase) {
  const studentsByHandle = new Map<string, Student>();
  const addStudent = (student?: Student) => {
    if (student?.handle && !studentsByHandle.has(student.handle)) {
      studentsByHandle.set(student.handle, student);
    }
  };
  const addProfile = (profile: unknown) => {
    if (!isRecord(profile)) return;
    const student = readStudent({
      name: profile.name,
      handle: profile.handle,
      course: profile.course,
      semester: profile.semester,
      campus: profile.campus,
      avatar: profile.avatar,
      photo: profile.photo,
    });
    if (student) addStudent(student);
  };

  Object.values(database.profiles).forEach(addProfile);
  Object.values(database.accounts).forEach((account) => addStudent(account.profile));
  database.posts.forEach((post) => addStudent(post.author));
  Object.values(database.commentsByPost).forEach((comments) => {
    const collect = (items: PostComment[]) => {
      items.forEach((comment) => {
        addStudent(comment.author);
        collect(comment.replies);
      });
    };
    collect(comments);
  });
  database.drops.forEach((drop) => addStudent(drop.author));
  database.communities.forEach((community) => addStudent(community.creator));
  database.events.forEach((event) => addStudent(event.author));
  database.lostFound.forEach((item) => addStudent(item.author));
  database.studyGroups.forEach((group) => addStudent(group.host));
  database.directConversations.forEach((conversation) => {
    conversation.participants.forEach(addStudent);
  });
  Object.entries(database.follows).forEach(([handle, targets]) => {
    addStudent(fallbackStudent(handle));
    targets.forEach((target) => addStudent(fallbackStudent(target)));
  });
  database.notifications.forEach((notification) => addStudent(notification.actor));

  return studentsByHandle;
}

function fallbackStudent(handle: string): Student {
  return {
    name: `@${handle}`,
    handle,
    course: "TheYep",
    semester: "Direct",
    campus: "Campus Paralela",
    avatar: handle.slice(0, 2).toUpperCase() || "YP",
  };
}

function getSocialGraph(database: TheYepDatabase, handle: string) {
  const follows = database.follows[handle] ?? [];
  const followers = Object.entries(database.follows)
    .filter(([, targets]) => targets.includes(handle))
    .map(([followerHandle]) => followerHandle);

  return { follows, followers };
}

function isMutualFollow(database: TheYepDatabase, leftHandle: string, rightHandle: string) {
  return (
    (database.follows[leftHandle] ?? []).includes(rightHandle) &&
    (database.follows[rightHandle] ?? []).includes(leftHandle)
  );
}

function assertCanMessageRecipients(database: TheYepDatabase, authorHandle: string, recipientHandles: string[]) {
  const blocked = recipientHandles.filter((recipientHandle) => !isMutualFollow(database, authorHandle, recipientHandle));
  if (blocked.length > 0) {
    throw createError(403, `Directs only work between mutual followers: @${blocked[0]}.`);
  }
}

function addNotification(
  database: TheYepDatabase,
  notification: Omit<Notification, "id" | "createdAt" | "read">,
) {
  if (notification.recipientHandle === notification.actor.handle) return;

  database.notifications.unshift({
    ...notification,
    id: `notification-${Date.now()}-${randomUUID()}`,
    createdAt: new Date().toISOString(),
    read: false,
  });

  database.notifications = database.notifications.slice(0, 320);
}

function getNotifications(database: TheYepDatabase, handle: string) {
  return database.notifications
    .filter((notification) => notification.recipientHandle === handle)
    .slice(0, 40);
}

function getDirectMessageSlice(
  messages: DirectMessage[],
  options: { before?: string; after?: string; limit?: number } = {},
) {
  const requestedLimit = Number.isFinite(options.limit) ? options.limit : directMessagePageSize;
  const limit = Math.min(72, Math.max(1, requestedLimit ?? directMessagePageSize));
  let start = Math.max(0, messages.length - limit);
  let end = messages.length;

  if (options.before) {
    const beforeIndex = messages.findIndex(
      (message) => message.id === options.before || message.createdAt === options.before,
    );
    end = beforeIndex >= 0 ? beforeIndex : 0;
    start = Math.max(0, end - limit);
  }

  if (options.after) {
    const afterIndex = messages.findIndex(
      (message) => message.id === options.after || message.createdAt === options.after,
    );
    start = afterIndex >= 0 ? afterIndex + 1 : messages.length;
    end = Math.min(messages.length, start + limit);
  }

  const slicedMessages = messages.slice(start, end);
  const messageWindow: DirectMessageWindow = {
    total: messages.length,
    hasMoreBefore: start > 0,
    hasMoreAfter: end < messages.length,
    beforeCursor: slicedMessages[0]?.id,
    afterCursor: slicedMessages[slicedMessages.length - 1]?.id,
  };

  return { messages: slicedMessages, messageWindow };
}

function withDirectMessageWindow(
  conversation: DirectConversation,
  options: { before?: string; after?: string; limit?: number } = {},
): DirectConversation {
  const messageSlice = getDirectMessageSlice(conversation.messages, options);

  return {
    ...conversation,
    ...messageSlice,
    lastMessage: conversation.messages[conversation.messages.length - 1],
  };
}

function getDirectConversations(database: TheYepDatabase, handle: string) {
  return database.directConversations
    .filter((conversation) => conversation.participants.some((participant) => participant.handle === handle))
    .map((conversation) => ({
      ...withDirectMessageWindow(conversation),
      unreadBy: conversation.unreadBy.filter((unreadHandle) => unreadHandle !== handle),
    }))
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

function buildDirectResponse(database: TheYepDatabase, handle: string, conversation: DirectConversation) {
  return {
    conversation: withDirectMessageWindow(conversation),
    directConversations: getDirectConversations(database, handle),
  };
}

function buildDirectMessagesResponse(
  database: TheYepDatabase,
  conversationId: string,
  handle: string,
  options: { before?: string; after?: string; limit?: number },
) {
  if (!handle) throw createError(400, "Missing user handle.");

  const conversation = database.directConversations.find((item) => item.id === conversationId);
  if (!conversation) throw createError(404, "Direct conversation not found.");
  if (!conversation.participants.some((participant) => participant.handle === handle)) {
    throw createError(403, "You are not a participant in this direct.");
  }

  return getDirectMessageSlice(conversation.messages, options);
}

function recomputeTrends(database: TheYepDatabase) {
  const counts = new Map<string, number>();
  database.posts.forEach((post) => {
    post.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
  });
  database.drops.forEach((drop) => {
    drop.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
  });

  const existingScopes = new Map(database.trends.map((trend) => [trend.tag, trend.scope]));
  const nextTrends = [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([tag, posts], index): Trend => ({
      tag,
      posts,
      scope: existingScopes.get(tag) ?? (index < 3 ? "Campus" : "All campuses"),
      heat: Math.min(100, Math.max(38, posts * 12)),
    }));

  database.trends = nextTrends;
}

function getCommentsByPost(database: TheYepDatabase) {
  return Object.fromEntries(
    Object.entries(database.commentsByPost).map(([postId, comments]) => [Number(postId), comments]),
  );
}

function getPosts(database: TheYepDatabase) {
  return database.posts.map((post) => ({
    ...post,
    comments: countComments(database.commentsByPost[String(post.id)] ?? []),
  }));
}

function getUserReactions(database: TheYepDatabase, handle: string) {
  const reactions: Record<number, ReactionKey[]> = {};

  Object.entries(database.postReactions).forEach(([key, value]) => {
    const [postId, reactionHandle] = key.split(":");
    if (reactionHandle === handle) {
      reactions[Number(postId)] = value;
    }
  });

  return reactions;
}

function getUserEventVotes(database: TheYepDatabase, handle: string) {
  const votes: Record<number, EventVoteChoice> = {};

  Object.entries(database.eventVotes).forEach(([key, value]) => {
    const [eventId, voterHandle] = key.split(":");
    if (voterHandle === handle) {
      votes[Number(eventId)] = value;
    }
  });

  return votes;
}

function getUserArray(collection: Record<string, number[]>, handle: string) {
  return collection[handle] ?? [];
}

function getCommunityMembers(database: TheYepDatabase) {
  const knownStudents = getKnownStudents(database);
  const members: Record<number, Student[]> = {};

  database.communities.forEach((community) => {
    const handles = new Set<string>([community.creator.handle]);
    Object.entries(database.joinedCommunities).forEach(([handle, communityIds]) => {
      if (communityIds.includes(community.id)) {
        handles.add(handle);
      }
    });

    members[community.id] = [...handles].map((handle) => knownStudents.get(handle) ?? fallbackStudent(handle));
  });

  return members;
}

function buildEventsResponse(database: TheYepDatabase, handle = "") {
  return {
    events: database.events,
    eventVotes: handle ? getUserEventVotes(database, handle) : {},
    rsvps: handle ? getUserArray(database.rsvps, handle) : [],
    authorStats: buildEventAuthorStats(database.events),
  };
}

function buildBootstrapResponse(database: TheYepDatabase, handle = "") {
  const socialGraph = handle ? getSocialGraph(database, handle) : { follows: [], followers: [] };
  const account = Object.values(database.accounts).find((item) => item.handle === handle);

  return {
    profile: handle ? database.profiles[handle] ?? account?.profile : undefined,
    posts: getPosts(database),
    commentsByPost: getCommentsByPost(database),
    userReactions: handle ? getUserReactions(database, handle) : {},
    drops: database.drops,
    directConversations: handle ? getDirectConversations(database, handle) : [],
    communities: database.communities,
    communityMembers: getCommunityMembers(database),
    joinedCommunities: handle ? getUserArray(database.joinedCommunities, handle) : [],
    ...buildEventsResponse(database, handle),
    studyGroups: database.studyGroups,
    joinedGroups: handle ? getUserArray(database.joinedGroups, handle) : [],
    lostFound: database.lostFound,
    reports: database.reports,
    trends: database.trends,
    follows: socialGraph.follows,
    followers: socialGraph.followers,
    notifications: handle ? getNotifications(database, handle) : [],
    knownStudents: [...getKnownStudents(database).values()],
  };
}

async function requestAuthCode(body: unknown) {
  if (!isRecord(body)) throw createError(400, "Invalid code request.");
  const email = normalizeAuthEmail(body.email);
  if (!isValidAuthEmail(email)) {
    throw createError(400, "Use a valid email address.");
  }

  return updateDatabase(async (database) => {
    if (database.accounts[email]) {
      throw createError(409, "This email already has a TheYep account.");
    }

    const code = String(randomInt(100000, 999999));
    database.verificationCodes[email] = {
      email,
      code,
      expiresAt: new Date(Date.now() + authCodeMinutes * 60_000).toISOString(),
      attempts: 0,
    };
    const result = await sendVerificationEmail(email, code);
    return {
      ok: true,
      sent: result.sent,
      devCode: result.sent ? undefined : result.devCode,
      message: result.sent
        ? "Verification code sent."
        : "SMTP is not configured yet. Dev code returned locally.",
    };
  });
}

async function checkHandleAvailability(handleValue: string) {
  const handle = normalizeUserHandle(handleValue);
  if (!isValidUserHandle(handle)) {
    throw createError(400, "Handles can use letters, numbers, '.', '_' and '-' only.");
  }

  const database = await readDatabase();
  const used =
    Object.values(database.accounts).some((account) => account.handle === handle) ||
    Boolean(database.profiles[handle]) ||
    getKnownStudents(database).has(handle);

  return { handle, available: !used };
}

async function registerAccount(body: unknown) {
  const payload = readAuthRegisterPayload(body);

  return updateDatabase((database) => {
    if (database.accounts[payload.email]) {
      throw createError(409, "This email already has a TheYep account.");
    }
    if (
      Object.values(database.accounts).some((account) => account.handle === payload.handle) ||
      Boolean(database.profiles[payload.handle])
    ) {
      throw createError(409, "This @ is already being used. Pick another one.");
    }

    const verification = database.verificationCodes[payload.email];
    if (!verification || verification.code !== payload.code || new Date(verification.expiresAt) < new Date()) {
      if (verification) verification.attempts += 1;
      throw createError(403, "Invalid or expired verification code.");
    }

    const { passwordHash, passwordSalt } = hashPassword(payload.password);
    const profile = {
      name: `${payload.firstName} ${payload.lastName}`.trim(),
      handle: payload.handle,
      course: "Unifacs",
      semester: "Student",
      campus: payload.campus,
      avatar: initialsFromName(payload.firstName, payload.lastName),
    };
    const account: UserAccount = {
      email: payload.email,
      handle: payload.handle,
      passwordHash,
      passwordSalt,
      profile,
      language: payload.language,
      createdAt: new Date().toISOString(),
    };

    database.accounts[payload.email] = account;
    database.profiles[payload.handle] = {
      name: profile.name,
      handle: profile.handle,
      avatar: profile.avatar,
      course: profile.course,
      semester: profile.semester,
      campus: profile.campus,
      bio: "",
      vibe: "new ✨",
      favoriteSpot: profile.campus,
      interests: [],
      theme: "pink",
      language: payload.language,
    };
    delete database.verificationCodes[payload.email];

    return {
      ...buildBootstrapResponse(database, payload.handle),
      session: {
        email: account.email,
        name: profile.name,
        campus: profile.campus,
        handle: profile.handle,
        language: account.language,
      },
      profile: database.profiles[payload.handle],
    };
  });
}

function initialsFromName(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.replace(/[^a-z0-9]/gi, "").toUpperCase() || "YP";
}

async function loginAccount(body: unknown) {
  const payload = readAuthLoginPayload(body);

  const database = await readDatabase();
  const account = Object.values(database.accounts).find(
    (item) => item.email === payload.emailOrHandle || item.handle === payload.emailOrHandle,
  );
  if (!account || !verifyPassword(payload.password, account)) {
    throw createError(403, "Invalid email/@ or password.");
  }

  return {
    ...buildBootstrapResponse(database, account.handle),
    session: {
      email: account.email,
      name: account.profile.name,
      campus: account.profile.campus,
      handle: account.handle,
      language: account.language,
    },
    profile: database.profiles[account.handle] ?? account.profile,
  };
}

function toggleNumber(collection: number[], id: number) {
  return collection.includes(id) ? collection.filter((item) => item !== id) : [...collection, id];
}

function updateMemberCount(current: number, joinedBefore: boolean, joinedAfter: boolean) {
  if (joinedBefore === joinedAfter) return current;
  return Math.max(0, current + (joinedAfter ? 1 : -1));
}

async function createEvent(body: unknown) {
  const payload = readCreatePayload(body);
  const startsAt = new Date(payload.startsAt);
  const now = new Date();

  if (Number.isNaN(startsAt.getTime()) || startsAt <= now) {
    throw createError(400, "Events must have a valid future date.");
  }

  return updateDatabase((database) => {
    const authorStats = buildEventAuthorStats(database.events, now);
    const postingStatus = getEventPostingStatus(payload.author, database.events, authorStats, now);

    if (postingStatus.isBlocked) {
      throw createError(403, `Event posting is paused until ${postingStatus.blockedUntil}.`);
    }

    if (postingStatus.postedThisWeek >= EVENT_WEEKLY_LIMIT) {
      throw createError(429, "This user already posted 2 events this week.");
    }

    const event: CampusEvent = {
      id: Date.now(),
      title: payload.title,
      category: payload.category,
      location: payload.location,
      startsAt: startsAt.toISOString(),
      createdAt: now.toISOString(),
      date: formatEventDate(startsAt.toISOString()),
      author: payload.author,
      campus: payload.author.campus,
      attendees: 0,
      editCount: 0,
      trueVotes: 0,
      falseVotes: 0,
    };

    database.events.unshift(event);
    return { event, ...buildEventsResponse(database, payload.author.handle) };
  });
}

async function updateEvent(id: number, body: unknown) {
  const payload = readUpdatePayload(body);
  const startsAt = new Date(payload.startsAt);
  const now = new Date();

  if (Number.isNaN(startsAt.getTime()) || startsAt <= now) {
    throw createError(400, "Events can only be edited to a valid future date.");
  }

  return updateDatabase((database) => {
    const index = database.events.findIndex((event) => event.id === id);
    if (index < 0) throw createError(404, "Event not found.");

    const event = database.events[index];
    if (event.author.handle !== payload.authorHandle) {
      throw createError(403, "Only the original poster can edit this event.");
    }
    if (isEventPast(event, now)) throw createError(403, "Past events cannot be edited.");
    if (event.editCount >= EVENT_EDIT_LIMIT) {
      throw createError(403, "This event has already used its 2 edits.");
    }

    const updatedEvent = {
      ...event,
      title: payload.title,
      category: payload.category,
      location: payload.location,
      startsAt: startsAt.toISOString(),
      date: formatEventDate(startsAt.toISOString()),
      campus: event.campus ?? event.author.campus,
      editCount: event.editCount + 1,
    };

    database.events[index] = updatedEvent;
    return { event: updatedEvent, ...buildEventsResponse(database, payload.authorHandle) };
  });
}

async function deleteEvent(id: number, body: unknown) {
  const { handle } = readHandlePayload(body);

  return updateDatabase((database) => {
    const index = database.events.findIndex((event) => event.id === id);
    if (index < 0) throw createError(404, "Event not found.");

    const event = database.events[index];
    if (event.author.handle !== handle && !canModerateAs(handle)) {
      throw createError(403, "Only the event author or founder account can delete this event.");
    }

    database.events.splice(index, 1);
    Object.keys(database.eventVotes).forEach((key) => {
      if (key.startsWith(`${id}:`)) delete database.eventVotes[key];
    });
    Object.keys(database.rsvps).forEach((memberHandle) => {
      database.rsvps[memberHandle] = database.rsvps[memberHandle].filter((eventId) => eventId !== id);
    });

    return buildEventsResponse(database, handle);
  });
}

async function voteOnEvent(id: number, body: unknown) {
  const payload = readVotePayload(body);

  return updateDatabase((database) => {
    const index = database.events.findIndex((event) => event.id === id);
    if (index < 0) throw createError(404, "Event not found.");

    const event = database.events[index];
    if (!isEventPast(event)) throw createError(403, "Voting opens after the event time.");

    const voteKey = `${id}:${payload.authorHandle}`;
    const previousVote = database.eventVotes[voteKey];
    const deltaFor = (choice: EventVoteChoice) => {
      if (previousVote === choice && payload.choice === choice) return -1;
      if (previousVote === choice && payload.choice !== choice) return -1;
      if (previousVote !== choice && payload.choice === choice) return 1;
      return 0;
    };

    const updatedEvent = {
      ...event,
      trueVotes: Math.max(0, event.trueVotes + deltaFor("true")),
      falseVotes: Math.max(0, event.falseVotes + deltaFor("false")),
    };

    if (previousVote === payload.choice) {
      delete database.eventVotes[voteKey];
    } else {
      database.eventVotes[voteKey] = payload.choice;
    }

    database.events[index] = updatedEvent;

    return {
      event: updatedEvent,
      userVote: database.eventVotes[voteKey] ?? null,
      falseEventThreshold: EVENT_FALSE_BLOCK_THRESHOLD,
      ...buildEventsResponse(database, payload.authorHandle),
    };
  });
}

async function toggleRsvp(id: number, body: unknown) {
  const { handle } = readHandlePayload(body);

  return updateDatabase((database) => {
    const index = database.events.findIndex((event) => event.id === id);
    if (index < 0) throw createError(404, "Event not found.");
    if (isEventPast(database.events[index])) throw createError(403, "Past events do not accept RSVPs.");

    const current = getUserArray(database.rsvps, handle);
    const joinedBefore = current.includes(id);
    const next = toggleNumber(current, id);
    database.rsvps[handle] = next;
    database.events[index] = {
      ...database.events[index],
      attendees: updateMemberCount(database.events[index].attendees, joinedBefore, next.includes(id)),
    };

    return buildEventsResponse(database, handle);
  });
}

async function createPost(body: unknown) {
  const payload = readPostCreatePayload(body);

  return updateDatabase((database) => {
    const community = payload.communityId
      ? database.communities.find((item) => item.id === payload.communityId)
      : undefined;
    if (payload.communityId && !community) {
      throw createError(404, "Community not found.");
    }
    if (community) {
      const membership = getUserArray(database.joinedCommunities, payload.author.handle);
      const isCreator = community.creator.handle === payload.author.handle;
      if (!isCreator && !membership.includes(community.id)) {
        throw createError(403, "Join the community before posting in its feed.");
      }
    }

    const visibility: PostVisibility = community
      ? payload.visibility === "community"
        ? "community"
        : "both"
      : "main";
    const now = new Date();
    const post: Post = {
      id: Date.now(),
      author: payload.author,
      time: "now",
      createdAt: now.toISOString(),
      body: payload.body,
      mood: payload.mood,
      image: payload.image,
      video: payload.video,
      campus: payload.author.campus,
      audience: payload.audience,
      tags: extractTags(payload.body),
      community: community?.name ?? "Campus Feed",
      communityId: community?.id,
      visibility,
      comments: 0,
      shares: 0,
      reactions: { yep: 0, nope: 0, loud: 0, mood: 0, iconic: 0, in: 0 },
    };

    database.posts.unshift(post);
    if (community) {
      database.communities = database.communities.map((item) =>
        item.id === community.id ? { ...item, topPost: payload.body.slice(0, 80) } : item,
      );
    }
    database.commentsByPost[String(post.id)] = [];
    recomputeTrends(database);

    return buildBootstrapResponse(database, payload.author.handle);
  });
}

async function createCommunityPost(id: number, body: unknown) {
  if (!isRecord(body)) throw createError(400, "Invalid post payload.");
  return createPost({ ...body, communityId: id });
}

async function reactToPost(postId: number, reaction: ReactionKey, body: unknown) {
  const { handle } = readHandlePayload(body);

  return updateDatabase((database) => {
    const index = database.posts.findIndex((post) => post.id === postId);
    if (index < 0) throw createError(404, "Post not found.");

    const key = `${postId}:${handle}`;
    const reactions = database.postReactions[key] ?? [];
    const hasReacted = reactions.includes(reaction);

    if (hasReacted) {
      database.postReactions[key] = reactions.filter((item) => item !== reaction);
      database.posts[index].reactions[reaction] = Math.max(0, database.posts[index].reactions[reaction] - 1);
      return buildBootstrapResponse(database, handle);
    }

    if (reactions.length >= 3) {
      throw createError(403, "Each user can pick up to 3 reactions per post.");
    }

    database.postReactions[key] = [...reactions, reaction];
    database.posts[index].reactions[reaction] += 1;
    addNotification(database, {
      recipientHandle: database.posts[index].author.handle,
      actor: database.posts[index].author.handle === handle ? database.posts[index].author : fallbackStudent(handle),
      type: "reaction",
      message: `@${handle} reacted ${reaction} to your Yep.`,
      targetId: String(postId),
    });
    return buildBootstrapResponse(database, handle);
  });
}

async function createComment(postId: number, body: unknown) {
  const payload = readCommentPayload(body);

  return updateDatabase((database) => {
    if (!database.posts.some((post) => post.id === postId)) throw createError(404, "Post not found.");

    const comment: PostComment = {
      id: `comment-${postId}-${Date.now()}`,
      author: payload.author,
      time: "now",
      body: payload.body,
      replies: [],
    };

    database.commentsByPost[String(postId)] = [comment, ...(database.commentsByPost[String(postId)] ?? [])];
    return buildBootstrapResponse(database, payload.author.handle);
  });
}

async function createReply(postId: number, parentId: string, body: unknown) {
  const payload = readCommentPayload(body);

  return updateDatabase((database) => {
    const comments = database.commentsByPost[String(postId)] ?? [];
    const parentTarget = findCommentTarget(comments, parentId);
    if (!parentTarget) throw createError(404, "Comment not found.");

    const reply: PostComment = {
      id: `reply-${parentId}-${Date.now()}`,
      author: payload.author,
      time: "now",
      body: payload.body,
      replyTo:
        parentTarget.depth > 0
          ? {
              id: parentTarget.comment.id,
              name: parentTarget.comment.author.name,
              handle: parentTarget.comment.author.handle,
            }
          : undefined,
      replies: [],
    };

    database.commentsByPost[String(postId)] = addReplyToComment(comments, parentTarget.rootId, reply);
    return buildBootstrapResponse(database, payload.author.handle);
  });
}

async function deletePost(postId: number, body: unknown) {
  const { handle } = readHandlePayload(body);

  return updateDatabase((database) => {
    const index = database.posts.findIndex((post) => post.id === postId);
    if (index < 0) throw createError(404, "Post not found.");
    if (database.posts[index].author.handle !== handle && !canModerateAs(handle)) {
      throw createError(403, "Only the post author can delete this post.");
    }

    database.posts.splice(index, 1);
    delete database.commentsByPost[String(postId)];
    Object.keys(database.postReactions).forEach((key) => {
      if (key.startsWith(`${postId}:`)) {
        delete database.postReactions[key];
      }
    });
    recomputeTrends(database);

    return buildBootstrapResponse(database, handle);
  });
}

async function deleteComment(postId: number, commentId: string, body: unknown) {
  const { handle } = readHandlePayload(body);

  return updateDatabase((database) => {
    const post = database.posts.find((item) => item.id === postId);
    if (!post) throw createError(404, "Post not found.");

    const comments = database.commentsByPost[String(postId)] ?? [];
    const target = findCommentTarget(comments, commentId);
    if (!target) throw createError(404, "Comment not found.");

    const isCommentAuthor = target.comment.author.handle === handle;
    const isPostAuthor = post.author.handle === handle;
    if (!isCommentAuthor && !isPostAuthor && !canModerateAs(handle)) {
      throw createError(403, "Only the comment author or post author can delete this comment.");
    }

    const result = removeCommentFromTree(comments, commentId);
    database.commentsByPost[String(postId)] = result.comments;

    return buildBootstrapResponse(database, handle);
  });
}

async function createDrop(body: unknown) {
  const payload = readDropCreatePayload(body);

  return updateDatabase((database) => {
    const drop = {
      id: Date.now(),
      author: payload.author,
      kind: payload.image ? ("photo" as const) : ("text" as const),
      body: payload.body,
      image: payload.image,
      campus: payload.author.campus,
      audience: "campus" as const,
      expiresIn: "24h",
      viewers: 0,
      tags: extractTags(payload.body),
    };

    database.drops.unshift(drop);
    recomputeTrends(database);
    return buildBootstrapResponse(database, payload.author.handle);
  });
}

async function startDirectConversation(body: unknown) {
  const payload = readDirectStartPayload(body);

  return updateDatabase((database) => {
    const knownStudents = getKnownStudents(database);
    const recipients = payload.recipientHandles.map((handle) => knownStudents.get(handle) ?? fallbackStudent(handle));
    assertCanMessageRecipients(
      database,
      payload.author.handle,
      recipients.map((recipient) => recipient.handle),
    );
    const now = new Date();
    const existingConversation =
      !payload.isGroup && recipients.length === 1
        ? database.directConversations.find((conversation) => {
            const handles = conversation.participants.map((participant) => participant.handle);
            return (
              !conversation.isGroup &&
              handles.length === 2 &&
              handles.includes(payload.author.handle) &&
              handles.includes(recipients[0].handle)
            );
          })
        : undefined;
    const message: DirectMessage = {
      id: `dm-${Date.now()}`,
      author: payload.author,
      body: payload.body,
      image: payload.image,
      createdAt: now.toISOString(),
      time: formatDirectTime(now),
    };

    if (existingConversation) {
      const updatedConversation: DirectConversation = {
        ...existingConversation,
        messages: [...existingConversation.messages, message],
        updatedAt: now.toISOString(),
        unreadBy: existingConversation.participants
          .map((participant) => participant.handle)
          .filter((handle) => handle !== payload.author.handle),
      };
      database.directConversations = database.directConversations.map((conversation) =>
        conversation.id === existingConversation.id ? updatedConversation : conversation,
      );
      updatedConversation.unreadBy.forEach((recipientHandle) =>
        addNotification(database, {
          recipientHandle,
          actor: payload.author,
          type: "direct",
          message: `@${payload.author.handle} sent you a direct.`,
          targetId: updatedConversation.id,
        }),
      );
      return buildDirectResponse(database, payload.author.handle, updatedConversation);
    }

    const conversation: DirectConversation = {
      id: payload.isGroup
        ? `direct-group-${payload.author.handle}-${Date.now()}`
        : `direct-${payload.author.handle}-${recipients[0].handle}-${Date.now()}`,
      title: payload.isGroup ? payload.title || "Campus group" : undefined,
      isGroup: payload.isGroup,
      avatar: payload.isGroup ? payload.avatar : undefined,
      kind: "social",
      participants: [payload.author, ...recipients],
      updatedAt: now.toISOString(),
      unreadBy: recipients.map((recipient) => recipient.handle),
      messages: [message],
    };

    database.directConversations.unshift(conversation);
    recipients.forEach((recipient) =>
      addNotification(database, {
        recipientHandle: recipient.handle,
        actor: payload.author,
        type: "direct",
        message: payload.isGroup
          ? `@${payload.author.handle} started a group direct.`
          : `@${payload.author.handle} sent you a direct.`,
        targetId: conversation.id,
      }),
    );
    return buildDirectResponse(database, payload.author.handle, conversation);
  });
}

async function sendDirectMessage(conversationId: string, body: unknown) {
  const payload = readDirectMessagePayload(body);

  return updateDatabase((database) => {
    const index = database.directConversations.findIndex((conversation) => conversation.id === conversationId);
    if (index < 0) throw createError(404, "Direct conversation not found.");

    const conversation = database.directConversations[index];
    if (!conversation.participants.some((participant) => participant.handle === payload.author.handle)) {
      throw createError(403, "You are not a participant in this direct.");
    }
    if ((conversation.kind ?? "social") === "social") {
      assertCanMessageRecipients(
        database,
        payload.author.handle,
        conversation.participants
          .map((participant) => participant.handle)
          .filter((handle) => handle !== payload.author.handle),
      );
    }

    const now = new Date();
    const message: DirectMessage = {
      id: `dm-${Date.now()}`,
      author: payload.author,
      body: payload.body,
      image: payload.image,
      createdAt: now.toISOString(),
      time: formatDirectTime(now),
    };
    const updatedConversation: DirectConversation = {
      ...conversation,
      messages: [...conversation.messages, message],
      updatedAt: now.toISOString(),
      unreadBy: conversation.participants
        .map((participant) => participant.handle)
        .filter((handle) => handle !== payload.author.handle),
    };

    database.directConversations[index] = updatedConversation;
    updatedConversation.unreadBy.forEach((recipientHandle) =>
      addNotification(database, {
        recipientHandle,
        actor: payload.author,
        type: "direct",
        message: `@${payload.author.handle} sent you a direct.`,
        targetId: updatedConversation.id,
      }),
    );
    return buildDirectResponse(database, payload.author.handle, updatedConversation);
  });
}

async function saveProfile(handle: string, body: unknown) {
  if (!isRecord(body)) throw createError(400, "Invalid profile payload.");
  const nextHandle = readString(body.handle).replace(/^@/, "") || handle;

  return updateDatabase((database) => {
    if (handle !== nextHandle && database.profiles[handle]) {
      delete database.profiles[handle];
    }
    database.profiles[nextHandle] = body;
    return { profile: database.profiles[nextHandle] };
  });
}

function removeCommentsByAuthor(comments: PostComment[], handle: string): PostComment[] {
  return comments
    .filter((comment) => comment.author.handle !== handle)
    .map((comment) => ({ ...comment, replies: removeCommentsByAuthor(comment.replies, handle) }));
}

async function deleteProfile(targetHandle: string, body: unknown) {
  const { handle } = readHandlePayload(body);
  const target = normalizeHandle(targetHandle);

  if (target !== handle && !canModerateAs(handle)) {
    throw createError(403, "Only the account owner or founder account can delete this profile.");
  }
  if (canModerateAs(target)) {
    throw createError(403, "Founder accounts cannot be deleted from here.");
  }

  return updateDatabase((database) => {
    delete database.profiles[target];
    delete database.follows[target];
    Object.keys(database.follows).forEach((memberHandle) => {
      database.follows[memberHandle] = database.follows[memberHandle].filter((followedHandle) => followedHandle !== target);
    });
    delete database.joinedCommunities[target];
    delete database.joinedGroups[target];
    delete database.rsvps[target];
    database.notifications = database.notifications.filter(
      (notification) => notification.recipientHandle !== target && notification.actor.handle !== target,
    );
    database.posts = database.posts.filter((post) => post.author.handle !== target);
    database.drops = database.drops.filter((drop) => drop.author.handle !== target);
    database.events = database.events.filter((event) => event.author.handle !== target);
    database.lostFound = database.lostFound.filter((item) => item.author.handle !== target);
    Object.entries(database.commentsByPost).forEach(([postId, comments]) => {
      if (!database.posts.some((post) => post.id === Number(postId))) {
        delete database.commentsByPost[postId];
      } else {
        database.commentsByPost[postId] = removeCommentsByAuthor(comments, target);
      }
    });
    Object.keys(database.postReactions).forEach((key) => {
      if (key.endsWith(`:${target}`)) delete database.postReactions[key];
    });
    Object.keys(database.eventVotes).forEach((key) => {
      if (key.endsWith(`:${target}`)) delete database.eventVotes[key];
    });
    recomputeTrends(database);

    return buildBootstrapResponse(database, handle === target ? "" : handle);
  });
}

async function createCommunity(body: unknown) {
  const payload = readCommunityCreatePayload(body);

  return updateDatabase((database) => {
    const alreadyCreated = database.communities.some(
      (community) => community.creator.handle === payload.author.handle,
    );
    if (alreadyCreated) {
      throw createError(403, "Each user can create only one community.");
    }

    const community: Community = {
      id: Date.now(),
      name: payload.name,
      category: payload.category,
      members: 1,
      accent: payload.accent,
      avatar: payload.avatar,
      campus: payload.author.campus,
      description: payload.description,
      topPost: "First post is waiting",
      creator: payload.author,
      createdAt: new Date().toISOString(),
    };

    database.communities.unshift(community);
    database.joinedCommunities[payload.author.handle] = [
      ...new Set([...(database.joinedCommunities[payload.author.handle] ?? []), community.id]),
    ];

    return {
      communities: database.communities,
      joinedCommunities: database.joinedCommunities[payload.author.handle],
      communityMembers: getCommunityMembers(database),
    };
  });
}

async function toggleCommunity(id: number, body: unknown) {
  const { handle } = readHandlePayload(body);

  return updateDatabase((database) => {
    const index = database.communities.findIndex((community) => community.id === id);
    if (index < 0) throw createError(404, "Community not found.");

    const current = getUserArray(database.joinedCommunities, handle);
    const joinedBefore = current.includes(id);
    const next = toggleNumber(current, id);
    database.joinedCommunities[handle] = next;
    database.communities[index] = {
      ...database.communities[index],
      members: updateMemberCount(database.communities[index].members, joinedBefore, next.includes(id)),
    };

    return {
      communities: database.communities,
      joinedCommunities: next,
      communityMembers: getCommunityMembers(database),
    };
  });
}

async function deleteCommunity(id: number, body: unknown) {
  const { handle } = readHandlePayload(body);

  return updateDatabase((database) => {
    const index = database.communities.findIndex((community) => community.id === id);
    if (index < 0) throw createError(404, "Community not found.");

    const community = database.communities[index];
    if (community.creator.handle !== handle && !canModerateAs(handle)) {
      throw createError(403, "Only the creator or founder account can delete this community.");
    }

    database.communities.splice(index, 1);
    database.posts = database.posts.filter((post) => post.communityId !== id);
    Object.keys(database.commentsByPost).forEach((postId) => {
      if (!database.posts.some((post) => post.id === Number(postId))) {
        delete database.commentsByPost[postId];
      }
    });
    Object.keys(database.joinedCommunities).forEach((memberHandle) => {
      database.joinedCommunities[memberHandle] = database.joinedCommunities[memberHandle].filter(
        (communityId) => communityId !== id,
      );
    });
    recomputeTrends(database);

    return {
      communities: database.communities,
      joinedCommunities: database.joinedCommunities[handle] ?? [],
      communityMembers: getCommunityMembers(database),
    };
  });
}

async function toggleFollow(targetHandle: string, body: unknown) {
  const { handle } = readHandlePayload(body);
  const target = normalizeHandle(targetHandle);

  if (!target || target === handle) {
    throw createError(400, "Pick another student to follow.");
  }

  return updateDatabase((database) => {
    const knownStudents = getKnownStudents(database);
    const targetStudent = knownStudents.get(target) ?? fallbackStudent(target);
    const current = database.follows[handle] ?? [];
    const isFollowing = current.includes(target);
    database.follows[handle] = isFollowing
      ? current.filter((item) => item !== target)
      : [...new Set([...current, target])];

    if (!isFollowing) {
      addNotification(database, {
        recipientHandle: target,
        actor: knownStudents.get(handle) ?? fallbackStudent(handle),
        type: "follow",
        message: `@${handle} started following you.`,
        targetId: targetStudent.handle,
      });
    }

    return {
      ...getSocialGraph(database, handle),
      notifications: getNotifications(database, handle),
    };
  });
}

async function createLostFound(body: unknown) {
  const payload = readLostFoundCreatePayload(body);

  return updateDatabase((database) => {
    const item: LostFound = {
      id: Date.now(),
      status: payload.status,
      item: payload.item,
      location: payload.location,
      contact: `@${payload.author.handle}`,
      author: payload.author,
      campus: payload.author.campus,
      createdAt: new Date().toISOString(),
      image: payload.image,
    };

    database.lostFound.unshift(item);
    return { lostFound: database.lostFound };
  });
}

async function deleteLostFound(id: number, body: unknown) {
  const { handle } = readHandlePayload(body);

  return updateDatabase((database) => {
    const index = database.lostFound.findIndex((item) => item.id === id);
    if (index < 0) throw createError(404, "Lost and found item not found.");

    const item = database.lostFound[index];
    if (item.author.handle !== handle && !canModerateAs(handle)) {
      throw createError(403, "Only the owner or founder account can delete this item.");
    }

    database.lostFound.splice(index, 1);
    return { lostFound: database.lostFound };
  });
}

async function contactLostFound(id: number, body: unknown) {
  const payload = readCommentPayload(body);

  return updateDatabase((database) => {
    const item = database.lostFound.find((entry) => entry.id === id);
    if (!item) throw createError(404, "Lost and found item not found.");
    if (item.author.handle === payload.author.handle) {
      throw createError(400, "This item already belongs to you.");
    }

    const now = new Date();
    const title = `Lost+Found: ${item.item}`;
    const participants = [payload.author, item.author];
    const existingConversation = database.directConversations.find(
      (conversation) =>
        conversation.kind === "lostfound" &&
        conversation.title === title &&
        conversation.participants.some((participant) => participant.handle === payload.author.handle) &&
        conversation.participants.some((participant) => participant.handle === item.author.handle),
    );
    const message: DirectMessage = {
      id: `dm-${Date.now()}`,
      author: payload.author,
      body: payload.body,
      createdAt: now.toISOString(),
      time: formatDirectTime(now),
    };

    const conversation: DirectConversation = existingConversation
      ? {
          ...existingConversation,
          messages: [...existingConversation.messages, message],
          updatedAt: now.toISOString(),
          unreadBy: [item.author.handle],
        }
      : {
          id: `lostfound-${id}-${payload.author.handle}-${Date.now()}`,
          title,
          kind: "lostfound",
          isGroup: false,
          participants,
          updatedAt: now.toISOString(),
          unreadBy: [item.author.handle],
          messages: [message],
        };

    if (existingConversation) {
      database.directConversations = database.directConversations.map((entry) =>
        entry.id === existingConversation.id ? conversation : entry,
      );
    } else {
      database.directConversations.unshift(conversation);
    }

    addNotification(database, {
      recipientHandle: item.author.handle,
      actor: payload.author,
      type: "lostfound",
      message: `@${payload.author.handle} contacted you about ${item.item}.`,
      targetId: conversation.id,
    });

    return {
      lostFound: database.lostFound,
      ...buildDirectResponse(database, payload.author.handle, conversation),
    };
  });
}

async function toggleGroup(id: number, body: unknown) {
  const { handle } = readHandlePayload(body);

  return updateDatabase((database) => {
    if (!database.studyGroups.some((group) => group.id === id)) throw createError(404, "Study group not found.");
    const next = toggleNumber(getUserArray(database.joinedGroups, handle), id);
    database.joinedGroups[handle] = next;
    return {
      studyGroups: database.studyGroups,
      joinedGroups: next,
    };
  });
}

async function createReport(body: unknown) {
  const payload = readReportPayload(body);

  return updateDatabase((database) => {
    const report: Report = {
      id: Date.now(),
      target: payload.target,
      reason: payload.reason,
      severity: payload.reason.includes("Threat") ? "High" : "Medium",
      status: "Open",
    };
    database.reports.unshift(report);
    return { reports: database.reports };
  });
}

async function resolveReport(id: number) {
  return updateDatabase((database) => {
    database.reports = database.reports.map((report) =>
      report.id === id ? { ...report, status: "Resolved" } : report,
    );
    return { reports: database.reports };
  });
}

async function markNotificationsRead(body: unknown) {
  const { handle } = readHandlePayload(body);

  return updateDatabase((database) => {
    database.notifications = database.notifications.map((notification) =>
      notification.recipientHandle === handle ? { ...notification, read: true } : notification,
    );

    return { notifications: getNotifications(database, handle) };
  });
}

function searchDatabase(database: TheYepDatabase, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return { posts: getPosts(database), drops: database.drops, events: database.events };
  }

  return {
    posts: getPosts(database).filter((post) => {
      const commentText = flattenCommentText(database.commentsByPost[String(post.id)] ?? []);
      const haystack =
        `${post.body} ${post.mood} ${post.author.name} ${post.community} ${post.tags.join(" ")} ${commentText}`.toLowerCase();
      return haystack.includes(normalized);
    }),
    drops: database.drops.filter((drop) => `${drop.body} ${drop.tags.join(" ")}`.toLowerCase().includes(normalized)),
    events: database.events.filter((event) =>
      `${event.title} ${event.category} ${event.location} ${event.author.handle}`.toLowerCase().includes(normalized),
    ),
  };
}

async function routeRequest(request: http.IncomingMessage, response: http.ServerResponse) {
  if (request.method === "OPTIONS") {
    sendNoContent(response);
    return;
  }

  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);
  const pathname = url.pathname;
  const method = request.method ?? "GET";
  const handle = readString(url.searchParams.get("handle") ?? "").replace(/^@/, "");

  if (pathname.startsWith("/api/") && isRateLimited(request)) {
    sendJson(response, 429, { error: "Too many requests. Try again in a minute." });
    return;
  }

  if (method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, { ok: true, service: "theyep-backend" });
    return;
  }

  if (method === "POST" && pathname === "/api/auth/request-code") {
    sendJson(response, 200, await requestAuthCode(await readJsonBody(request)));
    return;
  }

  if (method === "POST" && pathname === "/api/auth/register") {
    sendJson(response, 201, await registerAccount(await readJsonBody(request)));
    return;
  }

  if (method === "POST" && pathname === "/api/auth/login") {
    sendJson(response, 200, await loginAccount(await readJsonBody(request)));
    return;
  }

  const handleAvailabilityMatch = pathname.match(/^\/api\/auth\/handles\/([^/]+)$/);
  if (method === "GET" && handleAvailabilityMatch) {
    sendJson(response, 200, await checkHandleAvailability(decodeURIComponent(handleAvailabilityMatch[1])));
    return;
  }

  if (method === "POST" && pathname === "/api/r2/presign") {
    sendJson(response, 201, await createR2PresignedUpload(await readJsonBody(request)));
    return;
  }

  if (method === "POST" && pathname === "/api/uploads/chunk/init") {
    sendJson(response, 201, await createChunkUploadSession(await readJsonBody(request)));
    return;
  }

  const uploadChunkMatch = pathname.match(/^\/api\/uploads\/chunk\/([^/]+)\/(\d+)$/);
  if ((method === "PUT" || method === "POST") && uploadChunkMatch) {
    sendJson(
      response,
      200,
      await receiveUploadChunk(decodeURIComponent(uploadChunkMatch[1]), Number(uploadChunkMatch[2]), request),
    );
    return;
  }

  const completeChunkMatch = pathname.match(/^\/api\/uploads\/chunk\/([^/]+)\/complete$/);
  if (method === "POST" && completeChunkMatch) {
    sendJson(response, 201, await completeChunkUpload(decodeURIComponent(completeChunkMatch[1])));
    return;
  }

  if (method === "POST" && pathname === "/api/uploads") {
    sendJson(response, 201, await createUpload(request));
    return;
  }

  const uploadMatch = pathname.match(/^\/api\/uploads\/([^/]+)$/);
  if ((method === "GET" || method === "HEAD") && uploadMatch) {
    await serveUploadedMedia(uploadMatch[1], request, response);
    return;
  }

  if (method === "GET" && pathname === "/api/bootstrap") {
    const database = await readDatabase();
    sendJson(response, 200, buildBootstrapResponse(database, handle));
    return;
  }

  if (method === "GET" && pathname === "/api/search") {
    const database = await readDatabase();
    sendJson(response, 200, searchDatabase(database, url.searchParams.get("q") ?? ""));
    return;
  }

  if (method === "GET" && pathname === "/api/events") {
    const database = await readDatabase();
    sendJson(response, 200, buildEventsResponse(database, handle));
    return;
  }

  if (method === "POST" && pathname === "/api/events") {
    sendJson(response, 201, await createEvent(await readJsonBody(request)));
    return;
  }

  const eventUpdateMatch = pathname.match(/^\/api\/events\/(\d+)$/);
  if (method === "PATCH" && eventUpdateMatch) {
    sendJson(response, 200, await updateEvent(Number(eventUpdateMatch[1]), await readJsonBody(request)));
    return;
  }
  if (method === "DELETE" && eventUpdateMatch) {
    sendJson(response, 200, await deleteEvent(Number(eventUpdateMatch[1]), await readJsonBody(request)));
    return;
  }

  const eventVoteMatch = pathname.match(/^\/api\/events\/(\d+)\/vote$/);
  if (method === "POST" && eventVoteMatch) {
    sendJson(response, 200, await voteOnEvent(Number(eventVoteMatch[1]), await readJsonBody(request)));
    return;
  }

  const eventRsvpMatch = pathname.match(/^\/api\/events\/(\d+)\/rsvp$/);
  if (method === "POST" && eventRsvpMatch) {
    sendJson(response, 200, await toggleRsvp(Number(eventRsvpMatch[1]), await readJsonBody(request)));
    return;
  }

  if (method === "POST" && pathname === "/api/posts") {
    sendJson(response, 201, await createPost(await readJsonBody(request)));
    return;
  }

  const postDeleteMatch = pathname.match(/^\/api\/posts\/(\d+)$/);
  if (method === "DELETE" && postDeleteMatch) {
    sendJson(response, 200, await deletePost(Number(postDeleteMatch[1]), await readJsonBody(request)));
    return;
  }

  if (method === "POST" && pathname === "/api/communities") {
    sendJson(response, 201, await createCommunity(await readJsonBody(request)));
    return;
  }

  const postReactionMatch = pathname.match(/^\/api\/posts\/(\d+)\/reactions\/([a-z]+)$/);
  if (method === "POST" && postReactionMatch) {
    sendJson(
      response,
      200,
      await reactToPost(
        Number(postReactionMatch[1]),
        postReactionMatch[2] as ReactionKey,
        await readJsonBody(request),
      ),
    );
    return;
  }

  const postCommentMatch = pathname.match(/^\/api\/posts\/(\d+)\/comments$/);
  if (method === "POST" && postCommentMatch) {
    sendJson(response, 201, await createComment(Number(postCommentMatch[1]), await readJsonBody(request)));
    return;
  }

  const postCommentDeleteMatch = pathname.match(/^\/api\/posts\/(\d+)\/comments\/([^/]+)$/);
  if (method === "DELETE" && postCommentDeleteMatch) {
    sendJson(
      response,
      200,
      await deleteComment(
        Number(postCommentDeleteMatch[1]),
        decodeURIComponent(postCommentDeleteMatch[2]),
        await readJsonBody(request),
      ),
    );
    return;
  }

  const postReplyMatch = pathname.match(/^\/api\/posts\/(\d+)\/comments\/([^/]+)\/replies$/);
  if (method === "POST" && postReplyMatch) {
    sendJson(
      response,
      201,
      await createReply(Number(postReplyMatch[1]), decodeURIComponent(postReplyMatch[2]), await readJsonBody(request)),
    );
    return;
  }

  if (method === "POST" && pathname === "/api/drops") {
    sendJson(response, 201, await createDrop(await readJsonBody(request)));
    return;
  }

  if (method === "POST" && pathname === "/api/lost-found") {
    sendJson(response, 201, await createLostFound(await readJsonBody(request)));
    return;
  }

  const lostFoundMatch = pathname.match(/^\/api\/lost-found\/(\d+)$/);
  if (method === "DELETE" && lostFoundMatch) {
    sendJson(response, 200, await deleteLostFound(Number(lostFoundMatch[1]), await readJsonBody(request)));
    return;
  }

  const lostFoundContactMatch = pathname.match(/^\/api\/lost-found\/(\d+)\/contact$/);
  if (method === "POST" && lostFoundContactMatch) {
    sendJson(response, 201, await contactLostFound(Number(lostFoundContactMatch[1]), await readJsonBody(request)));
    return;
  }

  if (method === "POST" && pathname === "/api/direct/conversations") {
    sendJson(response, 201, await startDirectConversation(await readJsonBody(request)));
    return;
  }

  const directMessagesListMatch = pathname.match(/^\/api\/direct\/conversations\/([^/]+)\/messages$/);
  if (method === "GET" && directMessagesListMatch) {
    const database = await readDatabase();
    sendJson(
      response,
      200,
      buildDirectMessagesResponse(database, decodeURIComponent(directMessagesListMatch[1]), handle, {
        before: readString(url.searchParams.get("before") ?? ""),
        after: readString(url.searchParams.get("after") ?? ""),
        limit: Number(url.searchParams.get("limit") ?? directMessagePageSize),
      }),
    );
    return;
  }

  const directMessageMatch = pathname.match(/^\/api\/direct\/conversations\/([^/]+)\/messages$/);
  if (method === "POST" && directMessageMatch) {
    sendJson(
      response,
      201,
      await sendDirectMessage(decodeURIComponent(directMessageMatch[1]), await readJsonBody(request)),
    );
    return;
  }

  const profileMatch = pathname.match(/^\/api\/profiles\/([^/]+)$/);
  if (method === "GET" && profileMatch) {
    const database = await readDatabase();
    sendJson(response, 200, { profile: database.profiles[decodeURIComponent(profileMatch[1])] ?? null });
    return;
  }
  if (method === "PUT" && profileMatch) {
    sendJson(response, 200, await saveProfile(decodeURIComponent(profileMatch[1]), await readJsonBody(request)));
    return;
  }
  if (method === "DELETE" && profileMatch) {
    sendJson(response, 200, await deleteProfile(decodeURIComponent(profileMatch[1]), await readJsonBody(request)));
    return;
  }

  const communityMatch = pathname.match(/^\/api\/communities\/(\d+)\/join$/);
  if (method === "POST" && communityMatch) {
    sendJson(response, 200, await toggleCommunity(Number(communityMatch[1]), await readJsonBody(request)));
    return;
  }

  const communityDeleteMatch = pathname.match(/^\/api\/communities\/(\d+)$/);
  if (method === "DELETE" && communityDeleteMatch) {
    sendJson(response, 200, await deleteCommunity(Number(communityDeleteMatch[1]), await readJsonBody(request)));
    return;
  }

  const communityPostMatch = pathname.match(/^\/api\/communities\/(\d+)\/posts$/);
  if (method === "POST" && communityPostMatch) {
    sendJson(response, 201, await createCommunityPost(Number(communityPostMatch[1]), await readJsonBody(request)));
    return;
  }

  const groupMatch = pathname.match(/^\/api\/study-groups\/(\d+)\/join$/);
  if (method === "POST" && groupMatch) {
    sendJson(response, 200, await toggleGroup(Number(groupMatch[1]), await readJsonBody(request)));
    return;
  }

  if (method === "POST" && pathname === "/api/reports") {
    sendJson(response, 201, await createReport(await readJsonBody(request)));
    return;
  }

  const followMatch = pathname.match(/^\/api\/users\/([^/]+)\/follow$/);
  if (method === "POST" && followMatch) {
    sendJson(response, 200, await toggleFollow(decodeURIComponent(followMatch[1]), await readJsonBody(request)));
    return;
  }

  if (method === "PATCH" && pathname === "/api/notifications/read") {
    sendJson(response, 200, await markNotificationsRead(await readJsonBody(request)));
    return;
  }

  const reportResolveMatch = pathname.match(/^\/api\/reports\/(\d+)\/resolve$/);
  if (method === "PATCH" && reportResolveMatch) {
    sendJson(response, 200, await resolveReport(Number(reportResolveMatch[1])));
    return;
  }

  if (method === "GET" && !pathname.startsWith("/api/") && (await serveStatic(pathname, response))) {
    return;
  }

  throw createError(404, "Route not found.");
}

const server = http.createServer((request, response) => {
  routeRequest(request, response).catch((error: unknown) => {
    if (isRecord(error) && typeof error.status === "number" && typeof error.message === "string") {
      sendJson(response, error.status, { error: error.message });
      return;
    }

    const message = error instanceof Error ? error.message : "Unexpected backend error.";
    sendJson(response, 500, { error: message });
  });
});

server.listen(port, host, () => {
  console.log(`TheYep backend running at http://${host}:${port}`);
});
