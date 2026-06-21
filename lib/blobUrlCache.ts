type BlobUrlEntry = {
  url: string;
  consumers: number;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
};

const blobUrlCache = new Map<Blob, BlobUrlEntry>();
const COVER_URL_GRACE_MS = 45_000;

export function acquireBlobUrl(blob: Blob): string {
  const cached = blobUrlCache.get(blob);
  if (cached) {
    if (cached.cleanupTimer !== null) {
      clearTimeout(cached.cleanupTimer);
      cached.cleanupTimer = null;
    }
    cached.consumers += 1;
    return cached.url;
  }

  const entry = {
    url: URL.createObjectURL(blob),
    consumers: 1,
    cleanupTimer: null,
  };
  blobUrlCache.set(blob, entry);
  return entry.url;
}

export function releaseBlobUrl(blob: Blob): void {
  const cached = blobUrlCache.get(blob);
  if (!cached) return;

  cached.consumers = Math.max(0, cached.consumers - 1);
  if (cached.consumers > 0) return;

  if (cached.cleanupTimer !== null) return;
  cached.cleanupTimer = setTimeout(() => {
    const current = blobUrlCache.get(blob);
    if (!current || current !== cached || current.consumers > 0) return;
    URL.revokeObjectURL(current.url);
    blobUrlCache.delete(blob);
  }, COVER_URL_GRACE_MS);
}

export function resetBlobUrlCacheForTests(): void {
  for (const entry of blobUrlCache.values()) {
    if (entry.cleanupTimer !== null) clearTimeout(entry.cleanupTimer);
    URL.revokeObjectURL(entry.url);
  }
  blobUrlCache.clear();
}
