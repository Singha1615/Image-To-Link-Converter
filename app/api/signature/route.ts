import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const allowedFormats = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico", "avif"]);

export async function POST(request: Request) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: "Image storage is not configured yet. Add your Cloudinary credentials to the server environment." }, { status: 503 });
  }

  let body: { filename?: string; format?: string; bytes?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  const format = body.format?.toLowerCase().replace(/^\./, "");
  if (!format || !allowedFormats.has(format)) {
    return NextResponse.json({ error: "Unsupported image format." }, { status: 415 });
  }

  const maxBytes = (Number(process.env.MAX_UPLOAD_SIZE_MB) || 10) * 1024 * 1024;
  if (!Number.isFinite(body.bytes) || !body.bytes || body.bytes > maxBytes) {
    return NextResponse.json({ error: `Image must be smaller than ${Math.floor(maxBytes / 1024 / 1024)} MB.` }, { status: 413 });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `imagehost/${crypto.randomUUID()}`;
  const params = { folder: "imagehost", overwrite: "false", public_id: publicId, timestamp: String(timestamp), unique_filename: "false" };
  const toSign = Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("&");
  const signature = createHash("sha1").update(`${toSign}${apiSecret}`).digest("hex");

  return NextResponse.json({ cloudName, apiKey, timestamp, publicId, signature, maxBytes });
}
