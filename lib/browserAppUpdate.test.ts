import { afterEach, describe, expect, it, vi } from "vitest";
import { flushBeforeAppReload } from "./browserAppUpdate";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("explicit reload persistence barrier", () => {
  it("waits for all registered persistence owners", async () => {
    const target = new EventTarget();
    vi.stubGlobal("window", target);
    let finish!: () => void;
    const saved = new Promise<void>((resolve) => { finish = resolve; });
    target.addEventListener("ai-reader-before-reload", (event) => {
      (event as CustomEvent).detail.waitUntil(saved);
    });
    let completed = false;
    const flush = flushBeforeAppReload().then(() => { completed = true; });
    await Promise.resolve();
    expect(completed).toBe(false);
    finish();
    await flush;
    expect(completed).toBe(true);
  });
  it("propagates a failed save instead of settling it as success", async () => {
    const target = new EventTarget();
    vi.stubGlobal("window", target);
    target.addEventListener("ai-reader-before-reload", (event) => {
      (event as CustomEvent).detail.waitUntil(Promise.reject(new Error("quota")));
    });
    await expect(flushBeforeAppReload()).rejects.toThrow("quota");
  });
  it("does not hang the page forever on a stuck persistence owner", async () => {
    vi.useFakeTimers();
    const target = new EventTarget();
    vi.stubGlobal("window", target);
    target.addEventListener("ai-reader-before-reload", (event) => {
      (event as CustomEvent).detail.waitUntil(new Promise(() => {}));
    });
    const assertion = expect(flushBeforeAppReload()).rejects.toThrow("update-timeout");
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });
});
