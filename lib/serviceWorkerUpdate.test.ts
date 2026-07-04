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

function createWorkerFetchHandler() {
  const listeners: Record<string, EventListener[]> = {};
  const caches = {
    keys: vi.fn(async () => []),
    delete: vi.fn(async () => true),
    open: vi.fn(async () => ({ addAll: vi.fn(), put: vi.fn() })),
    match: vi.fn(async () => undefined),
  };
  const context = vm.createContext({
    caches,
    fetch: vi.fn(async () => {
      throw new Error("offline");
    }),
    Promise,
    Response,
    URL,
    self: {
      addEventListener: (type: string, listener: EventListener) => {
        listeners[type] = [...(listeners[type] ?? []), listener];
      },
      clients: { claim: vi.fn() },
      location: { origin: "https://reader.test" },
      skipWaiting: vi.fn(),
    },
  });
  vm.runInContext(workerSource, context);
  const fetchHandler = listeners.fetch?.[0];
  if (!fetchHandler) throw new Error("fetch handler was not registered");
  return { caches, fetchHandler };
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
  it("bypasses the HTTP cache when checking for a new worker", () => {
    expect(registrationSource).toContain('updateViaCache: "none"');
    expect(registrationSource).toContain("registration.update()");
  });

  it("reloads an already controlled page when the new worker takes over", () => {
    expect(registrationSource).toContain('"controllerchange"');
    expect(registrationSource).toContain("window.location.reload()");
  });

  it("uses network-first app resources with offline cache fallback", () => {
    expect(workerSource).toContain('const CACHE_NAME = "ai-reader-v3"');
    expect(workerSource).toContain("fetchAndCache(event.request)");
    expect(workerSource).not.toContain("cached || fetch(event.request)");
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
});
