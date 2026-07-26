const CACHE_NAME = "ai-reader-v6";
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
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME
          )
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

async function trimRuntimeCache(cache) {
  const requests = await cache.keys();
  const runtimeRequests = requests.filter((request) => {
    const pathname = new URL(request.url).pathname;
    return !STATIC_ASSETS.includes(pathname);
  });
  const excessCount = runtimeRequests.length - MAX_RUNTIME_CACHE_ENTRIES;
  if (excessCount <= 0) return;
  await Promise.all(
    runtimeRequests.slice(0, excessCount).map((request) => cache.delete(request))
  );
}

async function fetchAndCache(request, cacheKey = request) {
  const response = await fetch(request);
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

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.url.includes("/api/")) return;
  if (new URL(event.request.url).origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetchAndCache(event.request, "/")
        .catch(() => caches.match("/").then((response) => response || Response.error()))
    );
    return;
  }

  event.respondWith(
    fetchAndCache(event.request).catch(
      () => caches.match(event.request).then((response) => response || Response.error())
    )
  );
});
