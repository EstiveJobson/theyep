import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { r2Client, r2PublicUrl, r2VideoBucket } from "../_lib/r2.js";

const maxVideoBytes = Number(process.env.THEYEP_VIDEO_UPLOAD_LIMIT_BYTES ?? 500 * 1024 * 1024);
const allowedVideoTypes = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
]);

function extensionFor(contentType: string, filename: string) {
  const fromName = filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (fromName && ["mp4", "mov", "webm", "mkv"].includes(fromName)) return fromName;
  if (contentType === "video/mp4") return "mp4";
  if (contentType === "video/quicktime") return "mov";
  if (contentType === "video/webm") return "webm";
  if (contentType === "video/x-matroska") return "mkv";
  return "mp4";
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const { contentType, filename, size } = request.body ?? {};
  if (typeof contentType !== "string" || !allowedVideoTypes.has(contentType)) {
    response.status(415).json({ error: "Choose an MP4, MOV, WebM, or MKV video." });
    return;
  }
  if (typeof size !== "number" || size <= 0 || size > maxVideoBytes) {
    response.status(413).json({ error: "Video must be up to 500 MB." });
    return;
  }

  const safeFilename = typeof filename === "string" ? filename : "video.mp4";
  const key = `videos/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extensionFor(contentType, safeFilename)}`;
  const command = new PutObjectCommand({
    Bucket: r2VideoBucket,
    Key: key,
    ContentType: contentType,
    ContentLength: size,
  });
  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 60 * 5 });
  const publicUrl = r2PublicUrl ? `${r2PublicUrl.replace(/\/$/, "")}/${key}` : "";

  response.status(200).json({
    key,
    uploadUrl,
    publicUrl,
    expiresIn: 300,
  });
}
