/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium, devices } = require("@playwright/test");
const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const MARKER_NAME = "shared-sheet-ab-real-more-click";
const TRACE_WINDOW_US = 700_000;
const RUN_COUNT = 3;
const TRACE_CATEGORIES = [
  "-*",
  "devtools.timeline",
  "disabled-by-default-devtools.timeline",
  "disabled-by-default-devtools.timeline.frame",
  "disabled-by-default-devtools.timeline.invalidationTracking",
  "blink.user_timing",
  "cc",
  "disabled-by-default-cc.debug",
].join(",");
const TARGET_NAMES = ["UpdateLayoutTree", "Layout", "Paint", "RasterTask"];
const LIBRARY_ROOT =
  '[data-navigation-root="library"][aria-hidden="false"]';

function round(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function durationFor(run, name) {
  if (name === "RasterTask") {
    return run.trace.allThreads.RasterTask.totalMs;
  }
  return run.trace.mainThread[name].totalMs;
}

function evaluateDurationAcceptance(baselineRuns, candidateRuns) {
  const result = {};
  for (const name of ["UpdateLayoutTree", "Paint", "RasterTask"]) {
    const baselineMedianMs = median(
      baselineRuns.map((run) => durationFor(run, name))
    );
    const candidateValues = candidateRuns.map((run) => durationFor(run, name));
    const candidateMedianMs = median(candidateValues);
    const candidateMaximumMs = Math.max(...candidateValues);
    const ceilingMs = baselineMedianMs / 2;
    const medianPass = candidateMedianMs <= ceilingMs;
    const maximumPass = candidateMaximumMs <= ceilingMs;
    result[name] = {
      baselineMedianMs,
      ceilingMs,
      candidateMedianMs,
      candidateMaximumMs,
      medianPass,
      maximumPass,
      pass: medianPass && maximumPass,
    };
  }
  return result;
}

function mergedCoverage(intervals) {
  if (intervals.length === 0) return 0;
  intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let total = 0;
  let [start, end] = intervals[0];
  for (const [nextStart, nextEnd] of intervals.slice(1)) {
    if (nextStart <= end) {
      end = Math.max(end, nextEnd);
    } else {
      total += end - start;
      [start, end] = [nextStart, nextEnd];
    }
  }
  return total + end - start;
}

function selfDurationUs(target, completeEvents, windowStart, windowEnd) {
  const targetStart = Math.max(target.ts, windowStart);
  const targetEnd = Math.min(target.ts + target.dur, windowEnd);
  if (targetEnd <= targetStart) return 0;
  const children = [];
  for (const event of completeEvents) {
    if (
      event === target ||
      event.pid !== target.pid ||
      event.tid !== target.tid
    ) {
      continue;
    }
    const eventEnd = event.ts + event.dur;
    const targetFullEnd = target.ts + target.dur;
    const nested =
      event.ts >= target.ts &&
      eventEnd <= targetFullEnd &&
      (event.ts > target.ts || eventEnd < targetFullEnd);
    if (!nested) continue;
    const start = Math.max(event.ts, targetStart);
    const end = Math.min(eventEnd, targetEnd);
    if (end > start) children.push([start, end]);
  }
  return Math.max(
    0,
    targetEnd - targetStart - mergedCoverage(children)
  );
}

function summarizeEvents(events, marker) {
  const windowStart = marker.ts;
  const windowEnd = windowStart + TRACE_WINDOW_US;
  const completeEvents = events.filter(
    (event) =>
      event.ph === "X" &&
      typeof event.ts === "number" &&
      typeof event.dur === "number"
  );
  const threadNames = new Map(
    events
      .filter(
        (event) =>
          event.ph === "M" &&
          event.name === "thread_name" &&
          typeof event.args?.name === "string"
      )
      .map((event) => [`${event.pid}:${event.tid}`, event.args.name])
  );
  const summarize = (mainOnly) => {
    const result = {};
    for (const name of TARGET_NAMES) {
      const matches = completeEvents.filter(
        (event) =>
          event.name === name &&
          event.ts >= windowStart &&
          event.ts < windowEnd &&
          (!mainOnly ||
            (event.pid === marker.pid && event.tid === marker.tid))
      );
      const totalUs = matches.reduce(
        (total, event) =>
          total +
          Math.max(
            0,
            Math.min(event.ts + event.dur, windowEnd) - event.ts
          ),
        0
      );
      const selfUs = matches.reduce(
        (total, event) =>
          total +
          selfDurationUs(event, completeEvents, windowStart, windowEnd),
        0
      );
      result[name] = {
        count: matches.length,
        totalMs: round(totalUs / 1000),
        selfMs: round(selfUs / 1000),
      };
    }
    return result;
  };
  const finalTimestamp = events.reduce(
    (maximum, event) =>
      typeof event.ts === "number" ? Math.max(maximum, event.ts) : maximum,
    windowStart
  );
  return {
    marker: {
      name: marker.name,
      pid: marker.pid,
      tid: marker.tid,
      threadName:
        threadNames.get(`${marker.pid}:${marker.tid}`) ?? "unknown",
    },
    traceWindowMs: TRACE_WINDOW_US / 1000,
    traceCollectedAfterMarkerMs: round(
      (finalTimestamp - windowStart) / 1000
    ),
    eventFilter:
      'complete events (ph="X") with start timestamp >= click marker and < marker + 700000us; durations clipped at window end',
    mainThread: summarize(true),
    allThreads: summarize(false),
  };
}

async function prepare(page, run, baseURL, sampleText) {
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.locator(LIBRARY_ROOT).waitFor({ state: "visible" });
  await page
    .locator(`${LIBRARY_ROOT} [data-library-loading="false"]`)
    .waitFor({ state: "attached" });
  const covers = page.locator(`${LIBRARY_ROOT} [data-book-cover-origin]`);
  const priorCount = await covers.count();
  await page.locator('input[type="file"][accept*=".txt"]').setInputFiles({
    name: `shared-sheet-trace-${run}.txt`,
    mimeType: "text/plain",
    buffer: Buffer.from(sampleText),
  });
  await covers.nth(priorCount).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "列表" }).click();
  const more = page
    .locator(`${LIBRARY_ROOT} [data-library-book-more="true"]`)
    .first();
  await more.waitFor({ state: "visible" });
  await page.waitForTimeout(600);
  return more;
}

async function installMeasurement(page) {
  await page.evaluate(
    ({ marker, windowMs }) => {
      window.__sharedSheetTrace = { done: false, result: null };
      const intervals = [];
      const longTasks = [];
      const shifts = [];
      const observers = [];
      let clickAt = null;
      let mountedAt = null;
      let previousFrame = performance.now();

      const mutation = new MutationObserver(() => {
        if (
          clickAt !== null &&
          mountedAt === null &&
          document.querySelector(
            '[data-sheet-route="book-actions"] [data-motion-sheet="panel"]'
          )
        ) {
          mountedAt = performance.now();
        }
      });
      mutation.observe(document.body, { childList: true, subtree: true });

      const onClick = (event) => {
        if (
          clickAt === null &&
          event.target instanceof Element &&
          event.target.closest('[data-library-book-more="true"]')
        ) {
          clickAt = performance.now();
          performance.mark(marker);
          console.timeStamp(marker);
        }
      };
      document.addEventListener("click", onClick, true);

      for (const type of ["longtask", "layout-shift"]) {
        if (!PerformanceObserver.supportedEntryTypes.includes(type)) continue;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === "longtask") longTasks.push(entry);
            if (entry.entryType === "layout-shift") shifts.push(entry);
          }
        });
        observer.observe({ entryTypes: [type] });
        observers.push(observer);
      }

      const finish = () => {
        for (const observer of observers) {
          for (const entry of observer.takeRecords()) {
            if (entry.entryType === "longtask") longTasks.push(entry);
            if (entry.entryType === "layout-shift") shifts.push(entry);
          }
        }
        const endAt = clickAt + windowMs;
        const windowLongTasks = longTasks.filter(
          (entry) => entry.startTime >= clickAt && entry.startTime < endAt
        );
        const windowShifts = shifts.filter(
          (entry) => entry.startTime >= clickAt && entry.startTime < endAt
        );
        const sorted = [...intervals].sort((a, b) => a - b);
        window.__sharedSheetTrace = {
          done: true,
          result: {
            clickToMount:
              mountedAt === null ? null : mountedAt - clickAt,
            frames: intervals.length,
            p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
            maxFrame: intervals.length ? Math.max(...intervals) : 0,
            longTasks: windowLongTasks.length,
            maxLongTask: windowLongTasks.length
              ? Math.max(...windowLongTasks.map((entry) => entry.duration))
              : 0,
            totalLongTask: windowLongTasks.reduce(
              (total, entry) => total + entry.duration,
              0
            ),
            layoutShift: windowShifts.reduce(
              (total, entry) => total + entry.value,
              0
            ),
            observerSupport: {
              longtask:
                PerformanceObserver.supportedEntryTypes.includes("longtask"),
              layoutShift:
                PerformanceObserver.supportedEntryTypes.includes(
                  "layout-shift"
                ),
            },
          },
        };
        mutation.disconnect();
        document.removeEventListener("click", onClick, true);
        for (const observer of observers) observer.disconnect();
      };

      const sample = (now) => {
        if (clickAt !== null) {
          intervals.push(now - previousFrame);
          if (now - clickAt >= windowMs) {
            finish();
            return;
          }
        }
        previousFrame = now;
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    },
    { marker: MARKER_NAME, windowMs: TRACE_WINDOW_US / 1000 }
  );
}

async function readTrace(session, stream) {
  let trace = "";
  for (;;) {
    const chunk = await session.send("IO.read", { handle: stream });
    trace += chunk.data;
    if (chunk.eof) break;
  }
  await session.send("IO.close", { handle: stream });
  return JSON.parse(trace).traceEvents;
}

async function runTrace(browser, run, baseURL, sampleText) {
  const context = await browser.newContext({
    ...devices["iPhone 14"],
    locale: "zh-CN",
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  try {
    const more = await prepare(page, run, baseURL, sampleText);
    const box = await more.boundingBox();
    if (!box) throw new Error("More button geometry is unavailable");
    await installMeasurement(page);
    await session.send("Tracing.start", {
      categories: TRACE_CATEGORIES,
      transferMode: "ReturnAsStream",
    });
    await page.mouse.click(
      box.x + box.width / 2,
      box.y + box.height / 2
    );
    const panel = page.locator(
      '[data-sheet-route="book-actions"] [data-motion-sheet="panel"]'
    );
    await panel.waitFor({ state: "visible" });
    await page.waitForTimeout(50);
    const contract = await page.evaluate(() => {
      const overlay = document.querySelector(
        '[data-sheet-route="book-actions"] [data-motion-sheet="overlay"]'
      );
      const backdrop = document.querySelector(
        '[data-sheet-route="book-actions"] [data-motion-sheet="backdrop"]'
      );
      const panelElement = document.querySelector(
        '[data-sheet-route="book-actions"] [data-motion-sheet="panel"]'
      );
      if (
        !(overlay instanceof HTMLElement) ||
        !(panelElement instanceof HTMLElement)
      ) {
        throw new Error("Sheet runtime contract is unavailable");
      }
      return {
        hasExplicitBackdrop: backdrop instanceof HTMLElement,
        overlayInlineOpacity: overlay.style.opacity,
        overlayComputedOpacity: getComputedStyle(overlay).opacity,
        overlayBackdropToken: getComputedStyle(overlay)
          .getPropertyValue("--sheet-backdrop-opacity")
          .trim(),
        panelBackdropToken: getComputedStyle(panelElement)
          .getPropertyValue("--sheet-backdrop-opacity")
          .trim(),
      };
    });
    await page.waitForFunction(
      () => window.__sharedSheetTrace?.done === true
    );
    const metrics = await page.evaluate(
      () => window.__sharedSheetTrace.result
    );
    await page.waitForTimeout(50);
    const completed = new Promise((resolve) =>
      session.once("Tracing.tracingComplete", resolve)
    );
    await session.send("Tracing.end");
    const { stream } = await completed;
    const events = await readTrace(session, stream);
    const marker =
      events.find((event) => event.name === MARKER_NAME) ??
      events.find(
        (event) =>
          event.name === "TimeStamp" &&
          event.args?.data?.message === MARKER_NAME
      );
    if (!marker) throw new Error("Click trace marker was not captured");
    return {
      run,
      metrics,
      contract,
      trace: summarizeEvents(events, marker),
    };
  } finally {
    await session.detach();
    await context.close();
  }
}

async function main() {
  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3010";
  const revision = process.env.AB_REVISION ?? "unknown";
  const sampleText = readFileSync(
    path.resolve(process.cwd(), "e2e/fixtures/sample.txt"),
    "utf8"
  );
  const scriptSha256 = createHash("sha256")
    .update(readFileSync(__filename))
    .digest("hex");
  const browser = await chromium.launch({ headless: true });
  try {
    const browserVersion = browser.version();
    const runs = [];
    for (let run = 1; run <= RUN_COUNT; run += 1) {
      runs.push(await runTrace(browser, run, baseURL, sampleText));
    }
    const output = {
      schemaVersion: 1,
      evidenceRole: "trace-run",
      revision,
      script: {
        path: "scripts/shared-sheet-trace-probe.cjs",
        sha256: scriptSha256,
      },
      browserVersion,
      baseURL,
      device: "Playwright iPhone 14",
      readiness:
        "domcontentloaded + visible library + data-library-loading=false + deterministic TXT import + list mode + visible real More button + 600ms idle",
      context: "fresh isolated context per run; service workers blocked",
      click: "real page.mouse click at the visible More button center",
      traceCategories: TRACE_CATEGORIES,
      traceWindowUs: TRACE_WINDOW_US,
      runs,
    };
    console.log(JSON.stringify(output, null, 2));
  } finally {
    await browser.close();
  }
}

module.exports = {
  MARKER_NAME,
  TRACE_WINDOW_US,
  RUN_COUNT,
  TRACE_CATEGORIES,
  summarizeEvents,
  evaluateDurationAcceptance,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
