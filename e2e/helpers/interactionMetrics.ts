import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, type TestInfo } from "@playwright/test";

export type InteractionMetrics = {
  clickToMount: number | null;
  frames: number;
  p95Frame: number;
  maxFrame: number;
  maxLongTask: number;
  layoutShift: number;
  longTasks: Array<{ start: number; duration: number }>;
  inputEvents: Array<{ type: string; at: number }>;
  slowFrames: Array<{ at: number; interval: number }>;
};

export type InteractionProbeOptions = {
  durationMs: number;
  clickSelector?: string;
  mountSelector?: string;
};

export function expectInteractionBudget(
  metrics: InteractionMetrics,
  options: { requireMount?: boolean } = {}
) {
  if (options.requireMount) {
    expect(metrics.clickToMount).not.toBeNull();
    expect(metrics.clickToMount ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(50);
  }
  expect(metrics.frames).toBeGreaterThan(20);
  expect(metrics.p95Frame).toBeLessThanOrEqual(17);
  expect(metrics.maxLongTask).toBe(0);
  expect(metrics.layoutShift).toBe(0);
}

export async function collectInteractionMetrics(
  page: Page,
  options: InteractionProbeOptions
): Promise<InteractionMetrics> {
  return page.evaluate(async ({ durationMs, clickSelector, mountSelector }) => {
    const frameTimes: number[] = [];
    const intervals: number[] = [];
    const longTasks: number[] = [];
    const longTaskDetails: Array<{ start: number; duration: number }> = [];
    const inputEvents: Array<{ type: string; at: number }> = [];
    let layoutShift = 0;
    let clickedAt: number | null = null;
    let mountedAt: number | null = null;
    let previousFrame = performance.now();
    let animationFrame: number | null = null;
    const observers: PerformanceObserver[] = [];
    let mutationObserver: MutationObserver | undefined;
    let mutationObserved = false;
    let clickListenerRegistered = false;
    const startedAt = performance.now();

    const recordPointerInput = () => {
      inputEvents.push({ type: "pointerdown", at: performance.now() - startedAt });
    };
    const recordKeyboardInput = (event: KeyboardEvent) => {
      inputEvents.push({ type: `keydown:${event.key}`, at: performance.now() - startedAt });
    };

    const handleEntries = (entries: PerformanceEntryList) => {
      for (const entry of entries) {
        if (entry.entryType === "longtask") {
          longTasks.push(entry.duration);
          longTaskDetails.push({
            start: entry.startTime - startedAt,
            duration: entry.duration,
          });
        } else if (entry.entryType === "layout-shift") {
          const shift = entry as PerformanceEntry & {
            hadRecentInput?: boolean;
            sources?: Array<{ node?: Node | null }>;
            value: number;
          };
          if (shift.hadRecentInput) continue;
          const sources = shift.sources ?? [];
          const contained =
            sources.length > 0 &&
            sources.every(
              (source) =>
                source.node instanceof Element &&
                source.node.closest('[data-layout-shift-contained="true"]')
            );
          if (!contained) layoutShift += shift.value;
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
      document.addEventListener("pointerdown", recordPointerInput, true);
      document.addEventListener("keydown", recordKeyboardInput, true);
      recordMount();
      if (clickSelector) {
        document.addEventListener("click", clickListener, true);
        clickListenerRegistered = true;
      }

      await new Promise<void>((resolve) => {
        const sample = (now: number) => {
          frameTimes.push(now - startedAt);
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
      safely(() =>
        document.removeEventListener("pointerdown", recordPointerInput, true)
      );
      safely(() =>
        document.removeEventListener("keydown", recordKeyboardInput, true)
      );
      if (mutationObserved) {
        safely(() => mutationObserver?.disconnect());
      }
      for (const observer of observers) {
        safely(() => handleEntries(observer.takeRecords()));
        safely(() => observer.disconnect());
      }
    }

    const sampledFrameTimes = frameTimes.slice(2);
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
      longTasks: longTaskDetails,
      inputEvents,
      slowFrames: sampledIntervals.flatMap((interval, index) =>
        interval > 25
          ? [{ at: sampledFrameTimes[index] ?? 0, interval }]
          : []
      ),
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
