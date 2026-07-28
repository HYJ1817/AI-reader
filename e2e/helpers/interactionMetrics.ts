import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Page, TestInfo } from "@playwright/test";

export type InteractionMetrics = {
  clickToMount: number | null;
  frames: number;
  p95Frame: number;
  maxFrame: number;
  maxLongTask: number;
  layoutShift: number;
};

export type InteractionProbeOptions = {
  durationMs: number;
  clickSelector?: string;
  mountSelector?: string;
};

export async function collectInteractionMetrics(
  page: Page,
  options: InteractionProbeOptions
): Promise<InteractionMetrics> {
  return page.evaluate(async ({ durationMs, clickSelector, mountSelector }) => {
    const intervals: number[] = [];
    const longTasks: number[] = [];
    let layoutShift = 0;
    let clickedAt: number | null = null;
    let mountedAt: number | null = null;
    let previousFrame = performance.now();
    let animationFrame: number | null = null;
    const observers: PerformanceObserver[] = [];
    let mutationObserver: MutationObserver | undefined;
    let mutationObserved = false;
    let clickListenerRegistered = false;

    const handleEntries = (entries: PerformanceEntryList) => {
      for (const entry of entries) {
        if (entry.entryType === "longtask") {
          longTasks.push(entry.duration);
        } else if (entry.entryType === "layout-shift") {
          layoutShift += (entry as PerformanceEntry & { value: number }).value;
        }
      }
    };

    const recordMount = () => {
      if (
        clickedAt !== null &&
        mountedAt === null &&
        mountSelector &&
        document.querySelector(mountSelector)
      ) {
        mountedAt = performance.now();
      }
    };

    const clickListener = (event: MouseEvent) => {
      if (
        clickedAt === null &&
        event.target instanceof Element &&
        clickSelector &&
        event.target.closest(clickSelector)
      ) {
        clickedAt = performance.now();
        recordMount();
      }
    };

    try {
      mutationObserver = new MutationObserver(recordMount);
      for (const entryType of ["longtask", "layout-shift"] as const) {
        if (!PerformanceObserver.supportedEntryTypes.includes(entryType)) {
          continue;
        }
        const observer = new PerformanceObserver((list) => {
          handleEntries(list.getEntries());
        });
        observer.observe({ entryTypes: [entryType] });
        observers.push(observer);
      }

      mutationObserver.observe(document.body, { childList: true, subtree: true });
      mutationObserved = true;
      recordMount();
      if (clickSelector) {
        document.addEventListener("click", clickListener, true);
        clickListenerRegistered = true;
      }

      await new Promise<void>((resolve) => {
        const startedAt = performance.now();
        const sample = (now: number) => {
          intervals.push(now - previousFrame);
          previousFrame = now;
          if (now - startedAt >= durationMs) {
            resolve();
            return;
          }
          animationFrame = requestAnimationFrame(sample);
        };
        animationFrame = requestAnimationFrame(sample);
      });
    } finally {
      const safely = (operation: () => void) => {
        try {
          operation();
        } catch {
          // Cleanup errors must not hide a sampler setup or execution error.
        }
      };

      if (animationFrame !== null) {
        safely(() => cancelAnimationFrame(animationFrame!));
      }
      if (clickListenerRegistered) {
        safely(() => document.removeEventListener("click", clickListener, true));
      }
      if (mutationObserved) {
        safely(() => mutationObserver?.disconnect());
      }
      for (const observer of observers) {
        safely(() => handleEntries(observer.takeRecords()));
        safely(() => observer.disconnect());
      }
    }

    const sampledIntervals = intervals.slice(2);
    const sorted = [...sampledIntervals].sort((left, right) => left - right);
    return {
      clickToMount:
        clickedAt === null || mountedAt === null ? null : mountedAt - clickedAt,
      frames: sampledIntervals.length,
      p95Frame: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      maxFrame: sampledIntervals.length > 0 ? Math.max(...sampledIntervals) : 0,
      maxLongTask: longTasks.length > 0 ? Math.max(...longTasks) : 0,
      layoutShift,
    };
  }, options);
}

export async function attachInteractionMetrics(
  testInfo: TestInfo,
  name: string,
  metrics: InteractionMetrics
) {
  const evidencePath = testInfo.outputPath(`${name}.json`);
  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(
    evidencePath,
    JSON.stringify({ project: testInfo.project.name, ...metrics }, null, 2),
    "utf8"
  );
  await testInfo.attach(`${name}.json`, {
    path: evidencePath,
    contentType: "application/json",
  });
}
