import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const registrationSource = readFileSync(
  new URL("../app/ServiceWorkerRegistration.tsx", import.meta.url),
  "utf8"
);
const workerSource = readFileSync(
  new URL("../public/sw.js", import.meta.url),
  "utf8"
);

function createWorkerFetchHandler(options?: {
  fetch?: () => Promise<Response>;
  openCache?: () => Promise<unknown>;
  clientCount?: number;
}) {
  const listeners: Record<string, EventListener[]> = {};
  const caches = {
    keys: vi.fn(async () => []),
    delete: vi.fn(async () => true),
    open: vi.fn(
      options?.openCache ??
        (async () => ({
          addAll: vi.fn(),
          put: vi.fn(),
          keys: vi.fn(async () => []),
          delete: vi.fn(async () => true),
          match: vi.fn(async () => undefined),
        }))
    ),
    match: vi.fn(async () => undefined),
  };
  const context = vm.createContext({
    caches,
    fetch: vi.fn(
      options?.fetch ??
        (async () => {
          throw new Error("offline");
        })
    ),
    Promise,
    Response,
    URL,
    self: {
      addEventListener: (type: string, listener: EventListener) => {
        listeners[type] = [...(listeners[type] ?? []), listener];
      },
      clients: { claim: vi.fn(), matchAll: vi.fn(async () => Array.from({ length: options?.clientCount ?? 0 }, () => ({ type: "window" }))) },
      location: { origin: "https://reader.test" },
      skipWaiting: vi.fn(),
    },
  });
  vm.runInContext(workerSource, context);
  const fetchHandler = listeners.fetch?.[0];
  if (!fetchHandler) throw new Error("fetch handler was not registered");
  return { caches, fetchHandler, listeners, self: context.self };
}

async function resolveFetchResponse(
  fetchHandler: EventListener,
  request: { method: string; mode: string; url: string }
) {
  let responsePromise: Promise<Response> | null = null;
  fetchHandler({
    request,
    respondWith: (promise: Promise<Response>) => {
      responsePromise = promise;
    },
  } as unknown as Event);
  if (!responsePromise) throw new Error("respondWith was not called");
  return responsePromise;
}

describe("production service worker updates", () => {
  it("serves a retained immutable chunk after the deployment returns 404", async () => {
    const { fetchHandler, caches } = createWorkerFetchHandler({ fetch: async () => new Response("gone", { status: 404 }) });
    caches.match.mockResolvedValue(new Response("retained-chunk") as never);
    const response = await resolveFetchResponse(fetchHandler, { method: "GET", mode: "cors", url: "https://reader.test/_next/static/old-chunk.js" });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("retained-chunk");
  });
  it("prefers the current offline shell while retaining older client assets", async () => {
    const current = new Response("current-shell");
    const { fetchHandler, caches } = createWorkerFetchHandler({
      openCache: async () => ({ match: async () => current }),
    });
    caches.match.mockResolvedValue(new Response("old-shell") as never);
    const response = await resolveFetchResponse(fetchHandler, { method: "GET", mode: "navigate", url: "https://reader.test/" });
    expect(await response.text()).toBe("current-shell");
    expect(caches.match).not.toHaveBeenCalled();
  });
  it("bypasses the HTTP cache when checking for a new worker", () => {
    expect(registrationSource).toContain('updateViaCache: "none"');
    expect(registrationSource).toContain("registration.update()");
  });

  it("treats worker takeover as discovery, not reload authorization", () => {
    expect(registrationSource).toContain('"controllerchange"');
    expect(registrationSource).not.toContain("window.location.reload()");
    expect(registrationSource).toContain("appUpdate.discover(buildId)");
  });

  it("waits for explicit activation instead of skipping waiting during install", async () => {
    const { listeners, self } = createWorkerFetchHandler();
    const waits: Promise<unknown>[] = [];
    listeners.install[0]({ waitUntil: (task: Promise<unknown>) => waits.push(task) } as unknown as Event);
    await Promise.all(waits);
    expect(self.skipWaiting).not.toHaveBeenCalled();
    listeners.message[0]({ data: { type: "AI_READER_ACTIVATE" }, source: { type: "window", url: "https://reader.test/" }, waitUntil: (task: Promise<unknown>) => waits.push(task) } as unknown as Event);
    expect(self.skipWaiting).toHaveBeenCalledOnce();
  });

  it("retains old resources while any window may still run the old build", async () => {
    const { listeners, caches } = createWorkerFetchHandler({ clientCount: 2 });
    const waits: Promise<unknown>[] = [];
    listeners.activate[0]({ waitUntil: (task: Promise<unknown>) => waits.push(task) } as unknown as Event);
    await Promise.all(waits);
    expect(caches.delete).not.toHaveBeenCalled();
  });

  it("cleans only AI Reader caches when no old window remains", async () => {
    const { listeners, caches } = createWorkerFetchHandler();
    caches.keys.mockResolvedValue(["ai-reader-v6", "ai-reader-v7", "other-app"] as never);
    const waits: Promise<unknown>[] = [];
    listeners.activate[0]({ waitUntil: (task: Promise<unknown>) => waits.push(task) } as unknown as Event);
    await Promise.all(waits);
    expect(caches.delete.mock.calls).toEqual([["ai-reader-v6"]]);
  });

  it("checks the deployed build id when a suspended PWA resumes", () => {
    expect(registrationSource).toContain('fetch("/BUILD_ID"');
    expect(registrationSource).toContain('cache: "no-store"');
    expect(registrationSource).toContain('"visibilitychange"');
    expect(registrationSource).toContain('"focus"');
    expect(registrationSource).toContain("sessionStorage");
  });

  it("uses network-first app resources with offline cache fallback", () => {
    expect(workerSource).toContain('const CACHE_NAME = "ai-reader-v7"');
    expect(workerSource).toContain("fetchAndCache(event.request)");
    expect(workerSource).not.toContain("cached || fetch(event.request)");
  });

  it("bounds runtime cache growth without evicting pinned app-shell assets", () => {
    expect(workerSource).toContain("MAX_RUNTIME_CACHE_ENTRIES = 80");
    expect(workerSource).toContain("!STATIC_ASSETS.includes(pathname)");
    expect(workerSource).toContain("await trimRuntimeCache(cache)");
  });

  it("returns an error response for offline navigation cache misses", async () => {
    const { caches, fetchHandler } = createWorkerFetchHandler();

    const response = await resolveFetchResponse(fetchHandler, {
      method: "GET",
      mode: "navigate",
      url: "https://reader.test/library",
    });

    expect(caches.match).toHaveBeenCalledWith("/");
    expect(response).toBeInstanceOf(Response);
    expect(response.type).toBe("error");
  });

  it("returns an error response for offline resource cache misses", async () => {
    const { caches, fetchHandler } = createWorkerFetchHandler();
    const request = {
      method: "GET",
      mode: "same-origin",
      url: "https://reader.test/_next/static/chunk.js",
    };

    const response = await resolveFetchResponse(fetchHandler, request);

    expect(caches.match).toHaveBeenCalledWith(request);
    expect(response).toBeInstanceOf(Response);
    expect(response.type).toBe("error");
  });

  it("returns a successful network response when cache storage fails", async () => {
    const { fetchHandler } = createWorkerFetchHandler({
      fetch: async () => new Response("online", { status: 200 }),
      openCache: async () => {
        throw new Error("quota exceeded");
      },
    });

    const response = await resolveFetchResponse(fetchHandler, {
      method: "GET",
      mode: "same-origin",
      url: "https://reader.test/_next/static/chunk.js",
    });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("online");
  });
});
