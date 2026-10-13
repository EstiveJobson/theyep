const MAX_EDGE = 1080;
const QUALITY = 0.8;
const HARD_BYTES = 2 * 1024 * 1024;
const SOURCE_LIMIT = 30 * 1024 * 1024;

export const PHOTO_REJECTED = "Por enquanto só dá para postar fotos.";

export type CompressedPhoto = {
  blob: Blob;
  contentType: "image/webp" | "image/jpeg";
  extension: "webp" | "jpg";
};

export function photoRejection(file: File): string | null {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  const video = type.startsWith("video/") || /\.(mp4|mov|webm|m4v|mkv|avi)$/.test(name);
  const gif = type === "image/gif" || name.endsWith(".gif");
  if (video || gif) return PHOTO_REJECTED;

  const okType =
    type === "image/jpeg" ||
    type === "image/png" ||
    type === "image/webp" ||
    type === "image/heic" ||
    type === "image/heif";
  const okName = /\.(jpe?g|png|webp|heic|heif)$/.test(name);
  if (!okType && !okName) return "Escolha uma foto em JPEG, PNG ou WebP.";
  if (file.size > SOURCE_LIMIT) return "Essa foto é grande demais.";
  return null;
}

function canvasBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function draw(file: File, edge: number): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    return canvas;
  } finally {
    bitmap.close();
  }
}

async function encode(canvas: HTMLCanvasElement): Promise<CompressedPhoto> {
  const webp = await canvasBlob(canvas, "image/webp", QUALITY);
  if (webp && webp.size > 0 && webp.type === "image/webp") {
    return { blob: webp, contentType: "image/webp", extension: "webp" };
  }
  const jpeg = await canvasBlob(canvas, "image/jpeg", QUALITY);
  if (!jpeg || jpeg.size === 0) throw new Error("empty");
  return { blob: jpeg, contentType: "image/jpeg", extension: "jpg" };
}

/**
 * Longest side at most 1080px, WebP at quality 0.8.
 * JPEG at 0.8 when the browser cannot encode WebP.
 * Post photos and avatars both use this. Files already stored are left as they are.
 */
export async function compressPhoto(file: File): Promise<CompressedPhoto> {
  let edge = MAX_EDGE;
  let image = await encode(await draw(file, edge));

  while (image.blob.size > HARD_BYTES && edge > 480) {
    edge = Math.round(edge * 0.75);
    image = await encode(await draw(file, edge));
  }

  if (image.blob.size > HARD_BYTES) throw new Error("large");
  return image;
}
