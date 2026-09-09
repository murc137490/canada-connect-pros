import { supabase } from "@/integrations/supabase/client";

/** Extract object path inside a bucket from a public URL or return path if already relative. */
export function storagePathFromUrl(bucket: string, urlOrPath: string): string {
  const trimmed = urlOrPath.trim();
  const markers = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
    `/storage/v1/object/authenticated/${bucket}/`,
  ];
  for (const m of markers) {
    const idx = trimmed.indexOf(m);
    if (idx >= 0) return decodeURIComponent(trimmed.slice(idx + m.length).split("?")[0] ?? "");
  }
  return trimmed.replace(/^\/+/, "");
}

/** Detects bucket from URL if present, otherwise uses defaultBucket. */
export function detectBucketAndPath(defaultBucket: string, urlOrPath: string): { bucket: string; path: string } {
  const trimmed = urlOrPath.trim();
  const match = trimmed.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
  if (match) {
    return {
      bucket: match[1],
      path: decodeURIComponent(match[2].split("?")[0]),
    };
  }
  return {
    bucket: defaultBucket,
    path: storagePathFromUrl(defaultBucket, trimmed),
  };
}

/** Signed URL for display (private buckets); falls back to public URL. */
export async function resolveStorageDisplayUrl(
  bucket: string,
  urlOrPath: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  if (!urlOrPath?.trim()) return null;
  const target = detectBucketAndPath(bucket, urlOrPath);
  const { data, error } = await supabase.storage.from(target.bucket).createSignedUrl(target.path, expiresIn);
  if (!error && data?.signedUrl) return data.signedUrl;
  const { data: pub } = supabase.storage.from(target.bucket).getPublicUrl(target.path);
  return pub.publicUrl;
}

export async function resolveStorageDisplayUrls(
  bucket: string,
  items: (string | null | undefined)[],
  expiresIn = 3600,
): Promise<(string | null)[]> {
  return Promise.all(items.map((u) => resolveStorageDisplayUrl(bucket, u, expiresIn)));
}
