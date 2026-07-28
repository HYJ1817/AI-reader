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
    let animationFrame = 0;
    const observers: PerformanceObserver[] = [];

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
        mountedAt === null &&
        mountSelector &&
        document.querySelector(mountSelector)
      ) {
        mountedAt = performance.now();
      }
    };

    const mutationObserver = new MutationObserver(recordMount);
    const clickListener = (event: MouseEvent) => {
      if (
        clickedAt === null &&
        event.target instanceof Element &&
        clickSelector &&
        event.target.closest(clickSelector)
      ) {
        clickedAt = performance.now();
      }
    };

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
    recordMount();
    if (clickSelector) {
      document.addEventListener("click", clickListener, true);
    }

    try {
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
      cancelAnimationFrame(animationFrame);
      if (clickSelector) {
        document.removeEventListener("click", clickListener, true);
      }
      mutationObserver.disconnect();
      for (const observer of observers) {
        handleEntries(observer.takeRecords());
        observer.disconnect();
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
  await testInfo.attach(`${name}.json`, {
    body: JSON.stringify(
      { project: testInfo.project.name, metrics },
      null,
      2
    ),
    contentType: "application/json",
  });
}
