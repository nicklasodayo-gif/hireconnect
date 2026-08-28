import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Files are stored under server/uploads (never served directly by a static
// file route) and can only be retrieved through an authenticated download
// endpoint that checks ownership/authorization first.
export const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const ALLOWED_EXTENSIONS = new Set([".pdf", ".doc", ".docx"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export class UploadError extends Error { status = 400; }

export function saveBase64File(originalName: string, base64: string): string {
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new UploadError("Only PDF, DOC and DOCX files are allowed.");
  }
  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength > MAX_BYTES) {
    throw new UploadError("File exceeds the 5MB maximum upload size.");
  }
  if (buffer.byteLength === 0) {
    throw new UploadError("Uploaded file is empty.");
  }
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const safeName = `${randomUUID()}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, safeName), buffer);
  return safeName;
}

export function readUploadedFile(storedName: string): Buffer {
  // Reject any path traversal attempt outright.
  if (storedName.includes("..") || storedName.includes("/") || storedName.includes("\\")) {
    throw new UploadError("Invalid file reference.");
  }
  return fs.readFileSync(path.join(UPLOAD_DIR, storedName));
}
