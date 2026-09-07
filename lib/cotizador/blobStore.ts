// Small wrapper around Vercel Blob so the rest of the code doesn't care whether
// we're on Vercel (persistent Blob storage) or local dev (writes to public/).
//
// The images Blob store was connected with the "SUNTECH" env-var prefix, so its
// read-write token is SUNTECH_READ_WRITE_TOKEN. We also accept the default
// BLOB_READ_WRITE_TOKEN in case the store is later reconnected without a prefix.

export const BLOB_TOKEN =
  process.env.SUNTECH_READ_WRITE_TOKEN ?? process.env.BLOB_READ_WRITE_TOKEN ?? "";

export const hasBlob = () => BLOB_TOKEN.length > 0;

// Public base URL of the Blob store, e.g.
// https://<storeid>.public.blob.vercel-storage.com
//
// Derived from the store id (env) or the token itself
// (vercel_blob_rw_<storeId>_<secret>). We use this to READ data blobs with a
// plain HTTP GET against a deterministic pathname — a plain GET is NOT a billed
// Blob operation, whereas list() is an "Advanced Operation" with a tiny free
// quota (2k/mo) that the old newest-URL lookup blew through on every request.
export function blobBaseUrl(): string {
  const raw =
    process.env.SUNTECH_STORE_ID ??
    process.env.BLOB_STORE_ID ??
    BLOB_TOKEN.split("_")[3] ??
    "";
  const storeId = raw.replace(/^store_/, "").toLowerCase();
  return `https://${storeId}.public.blob.vercel-storage.com`;
}
