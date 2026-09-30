const CACHE_NAME = "ai-reader-v7";
const CACHE_PREFIX = "ai-reader-";
const MAX_RUNTIME_CACHE_ENTRIES = 80;
const STATIC_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "AI_READER_ACTIVATE" || event.source?.type !== "window") return;
  if (new URL(event.source.url).origin !== self.location.origin) return;
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Another client may still need its previous lazy-loaded chunks offline.
      if (windows.length === 0) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
      }
      await self.clients.claim();
    })()
  );
});

async function trimRuntimeCache(cache) {
  const requests = await cache.keys();
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const runtimeRequests = requests.filter((request) => {
    const pathname = new URL(request.url).pathname;
    return !STATIC_ASSETS.includes(pathname) && !(windows.length > 0 && pathname.startsWith("/_next/static/"));
  });
  const excessCount = runtimeRequests.length - MAX_RUNTIME_CACHE_ENTRIES;
  if (excessCount <= 0) return;
  await Promise.all(
    runtimeRequests.slice(0, excessCount).map((request) => cache.delete(request))
  );
}

async function fetchAndCache(request, cacheKey = request) {
  const response = await fetch(request);
  if (!response.ok && new URL(request.url).pathname.startsWith("/_next/static/")) {
    const retained = await cachedResponse(request);
    if (retained.ok) return retained;
  }
  if (response.ok) {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(cacheKey, response.clone());
      await trimRuntimeCache(cache);
    } catch {
      // A cache quota/storage failure must not hide a successful network response.
    }
  }
  return response;
}

async function cachedResponse(request) {
  try {
    const current = await (await caches.open(CACHE_NAME)).match(request);
    if (current) return current;
  } catch {
    // Retained caches may still serve an old client's immutable resources.
  }
  return (await caches.match(request)) || Response.error();
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.url.includes("/api/")) return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  if (new URL(event.request.url).pathname === "/BUILD_ID") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetchAndCache(event.request, "/")
        .catch(() => cachedResponse("/"))
    );
    return;
  }

  event.respondWith(
    fetchAndCache(event.request).catch(
      () => cachedResponse(event.request)
    )
  );
});
