// Persistent JSON storage that survives Vercel's ephemeral filesystem.
//
// Source-of-truth rule the project wants:
//   - The committed /data/<file> is the base. While it is unchanged, admin edits
//     are stored in Blob and persist across deploys.
//   - The moment you change a committed /data/<file> and redeploy, that file wins
//     again and the Blob copy is reset from it (admin edits on that file are
//     dropped, on purpose).
//
// How: alongside the data blob we keep a tiny `seed/<key>` blob holding a hash of
// the committed file it was seeded from. On read, if the committed file's hash
// still matches the stored seed hash we serve the Blob copy (admin edits);
// otherwise we re-seed Blob from the committed file.
//
// Cost note: we use DETERMINISTIC pathnames + overwrite, and read blobs with a
// plain HTTP GET on their public URL. We never call list()/del() — those are
// Vercel "Advanced Operations" (2k/mo free) and the old "find newest blob"
// lookup ran two list() calls on every request, which exhausted the quota and
// took the site down. put() is a "Simple Operation" (much larger quota) and a
// GET on a blob URL is not a billed operation at all.
//
// Locally (no BLOB_READ_WRITE_TOKEN) everything is just plain fs on /data/<file>.

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { put } from "@vercel/blob";
import { BLOB_TOKEN, hasBlob, blobBaseUrl } from "./blobStore";

const CACHE_TTL_MS = 60_000;

type CacheEntry = { at: number; data: unknown };
const cache = new Map<string, CacheEntry>();

function localPath(file: string): string {
  return path.join(process.cwd(), "data", file);
}

async function readLocalRaw(file: string): Promise<string | null> {
  try {
    return await fs.readFile(localPath(file), "utf-8");
  } catch {
    return null;
  }
}

const hashOf = (s: string) =>
  crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);

async function putBlob(pathname: string, body: string, contentType: string): Promise<void> {
  await put(pathname, body, {
    access: "public",
    token: BLOB_TOKEN,
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
}

/**
 * Read a deterministic blob by its public URL. Returns null when the blob does
 * not exist. The Vercel Blob CDN answers a missing public object with 404 *or*
 * 403 (S3-style AccessDenied) depending on the store, so both mean "not there
 * yet" → caller re-seeds.
 */
async function getBlob(pathname: string): Promise<string | null> {
  const res = await fetch(`${blobBaseUrl()}/${pathname}`, { cache: "no-store" });
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`Blob GET ${pathname} failed: ${res.status}`);
  return res.text();
}

/** Persist a data file. Called by admin saves — does NOT touch the seed marker. */
export async function writeJson(key: string, file: string, data: unknown): Promise<void> {
  const body = JSON.stringify(data, null, 2);
  cache.set(key, { at: Date.now(), data });

  if (hasBlob()) {
    await putBlob(`data/${key}.json`, body, "application/json");
    return;
  }

  await fs.mkdir(path.dirname(localPath(file)), { recursive: true });
  await fs.writeFile(localPath(file), body + "\n", "utf-8");
}

async function reseedFromFile<T>(key: string, raw: string | null, fallback: T): Promise<T> {
  const data = raw ? (JSON.parse(raw) as T) : fallback;
  const seedHash = raw ? hashOf(raw) : "empty";
  await putBlob(`data/${key}.json`, JSON.stringify(data, null, 2), "application/json");
  await putBlob(`seed/${key}.txt`, seedHash, "text/plain");
  return data;
}

export async function readJson<T>(key: string, file: string, fallback: T): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data as T;

  const raw = await readLocalRaw(file);
  const fromFile = (): T => (raw ? (JSON.parse(raw) as T) : fallback);
  let data: T;

  if (hasBlob()) {
    try {
      const seedHash = raw ? hashOf(raw) : "empty";
      const [blobData, storedSeed] = await Promise.all([
        getBlob(`data/${key}.json`),
        getBlob(`seed/${key}.txt`),
      ]);

      if (blobData != null && storedSeed?.trim() === seedHash) {
        // Committed file unchanged since seeding → serve the Blob copy (admin edits).
        data = JSON.parse(blobData) as T;
      } else {
        // First run, or the committed file changed → reset Blob from the file.
        data = await reseedFromFile<T>(key, raw, fallback);
      }
    } catch (err) {
      // Blob store unreachable / suspended / over quota. Degrade to the committed
      // file so the public site keeps rendering (admin edits just won't show
      // until the store is back). Do NOT cache this — retry on the next request.
      console.error(`readJson(${key}) blob read failed, serving committed file`, err);
      return fromFile();
    }
  } else {
    data = fromFile();
  }

  cache.set(key, { at: Date.now(), data });
  return data;
}
