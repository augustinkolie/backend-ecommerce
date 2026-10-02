import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";
import { randomToken } from "./auth";

const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export function extensionFor(contentType: string) {
  return ALLOWED.get(contentType);
}

function objectKey(contentType: string) {
  const d = new Date();
  return `products/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${randomToken().slice(0, 20)}.${extensionFor(contentType)}`;
}

/**
 * Pilote S3 : URL signée (PUT direct du navigateur vers le stockage).
 * Pilote local : le fichier est envoyé à /admin/uploads/local et servi par le backend.
 */
export async function createUpload(contentType: string) {
  const e = env();
  const key = objectKey(contentType);
  if (e.STORAGE_DRIVER === "s3") {
    const client = new S3Client({
      region: e.S3_REGION,
      endpoint: e.S3_ENDPOINT,
      forcePathStyle: true,
      credentials: { accessKeyId: e.S3_ACCESS_KEY!, secretAccessKey: e.S3_SECRET_KEY! },
    });
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: e.S3_BUCKET!, Key: key, ContentType: contentType }),
      { expiresIn: 300 },
    );
    return { method: "PUT" as const, uploadUrl, publicUrl: `${e.S3_PUBLIC_URL}/${key}`, key };
  }
  return {
    method: "POST" as const,
    uploadUrl: `/admin/uploads/local?key=${encodeURIComponent(key)}`,
    publicUrl: `${e.PUBLIC_API_URL}/uploads/${key}`,
    key,
  };
}

export async function saveLocal(key: string, data: ArrayBuffer) {
  if (!/^products\/\d{4}\/\d{2}\/[\w-]+\.(jpg|png|webp|avif)$/.test(key)) throw new Error("clé invalide");
  const file = path.join(process.cwd(), "public", "uploads", key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(data));
}
