import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const registrationSource = readFileSync(
  new URL("../app/ServiceWorkerRegistration.tsx", import.meta.url),
  "utf8"
);
const workerSource = readFileSync(
  new URL("../public/sw.js", import.meta.url),
  "utf8"
);

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
});
