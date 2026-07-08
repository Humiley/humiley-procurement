import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Storage adapter (spec §22.2 lib/storage). Local-disk in dev under STORAGE_DIR; the interface
 * (saveUpload/readStored/deleteStored) is deliberately small so it can be swapped for S3 /
 * SharePoint later without touching callers.
 */
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), "storage");
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export type StoredFile = { storagePath: string; sizeBytes: number };

export async function saveUpload(file: File, subdir = "attachments"): Promise<StoredFile> {
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error("File exceeds the 20 MB limit.");
  const dir = path.join(STORAGE_DIR, subdir);
  await fs.mkdir(dir, { recursive: true });
  const ext = path.extname(file.name).slice(0, 12).replace(/[^.\w]/g, "");
  const rel = path.join(subdir, `${randomUUID()}${ext}`);
  await fs.writeFile(path.join(STORAGE_DIR, rel), buf);
  return { storagePath: rel, sizeBytes: buf.length };
}

export async function readStored(storagePath: string): Promise<Buffer> {
  // Guard against path traversal — the stored path must resolve inside STORAGE_DIR.
  const abs = path.resolve(STORAGE_DIR, storagePath);
  if (!abs.startsWith(path.resolve(STORAGE_DIR))) throw new Error("Invalid path.");
  return fs.readFile(abs);
}

export async function deleteStored(storagePath: string): Promise<void> {
  try {
    const abs = path.resolve(STORAGE_DIR, storagePath);
    if (abs.startsWith(path.resolve(STORAGE_DIR))) await fs.unlink(abs);
  } catch {
    // best-effort; missing file is fine
  }
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
