const MAX_EDGE = 1600;
const TARGET_BYTES = 1_000_000;
const HARD_BYTES = 2 * 1024 * 1024;
const SOURCE_LIMIT = 30 * 1024 * 1024;

export const PHOTO_REJECTED = "Por enquanto só dá para postar fotos.";

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

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("empty"));
      },
      "image/jpeg",
      quality,
    );
  });
}

async function render(file: File, edge: number, quality: number): Promise<Blob> {
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
    return await toJpeg(canvas, quality);
  } finally {
    bitmap.close();
  }
}

/** Longest side 1600px, JPEG, about 1 MB. Throws if the browser cannot read the file. */
export async function compressPhoto(file: File): Promise<Blob> {
  let edge = MAX_EDGE;
  let quality = 0.86;
  let blob = await render(file, edge, quality);

  while (blob.size > TARGET_BYTES && quality > 0.5) {
    quality = Math.round((quality - 0.12) * 100) / 100;
    blob = await render(file, edge, quality);
  }

  while (blob.size > TARGET_BYTES && edge > 800) {
    edge = Math.round(edge * 0.75);
    blob = await render(file, edge, quality);
  }

  if (blob.size > HARD_BYTES) {
    throw new Error("large");
  }
  return blob;
}
