import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const probePath = path.resolve(
  process.cwd(),
  "scripts/shared-sheet-trace-probe.cjs"
);
const evidencePath = (name: string) =>
  path.resolve(process.cwd(), "docs/performance", name);
const probe = require(probePath) as {
  MARKER_NAME: string;
  TRACE_WINDOW_US: number;
  RUN_COUNT: number;
  summarizeEvents: (
    events: Array<Record<string, unknown>>,
    marker: Record<string, unknown>
  ) => Record<string, unknown>;
  evaluateDurationAcceptance: (
    baselineRuns: Array<Record<string, unknown>>,
    candidateRuns: Array<Record<string, unknown>>
  ) => Record<string, unknown>;
};

describe("shared sheet trace probe", () => {
  it("analyzes the exact marker-relative window on the correct threads", () => {
    const marker = {
      name: "shared-sheet-ab-real-more-click",
      ph: "R",
      pid: 1,
      tid: 10,
      ts: 1_000,
    };
    const events = [
      marker,
      {
        ph: "M",
        name: "thread_name",
        pid: 1,
        tid: 10,
        args: { name: "CrRendererMain" },
      },
      {
        ph: "X",
        name: "UpdateLayoutTree",
        pid: 1,
        tid: 10,
        ts: 1_100,
        dur: 100,
      },
      {
        ph: "X",
        name: "FunctionCall",
        pid: 1,
        tid: 10,
        ts: 1_120,
        dur: 30,
      },
      {
        ph: "X",
        name: "Paint",
        pid: 1,
        tid: 10,
        ts: 1_300,
        dur: 50,
      },
      {
        ph: "X",
        name: "RasterTask",
        pid: 1,
        tid: 20,
        ts: 1_400,
        dur: 80,
      },
      {
        ph: "X",
        name: "Layout",
        pid: 1,
        tid: 10,
        ts: 701_000,
        dur: 100,
      },
    ];

    const summary = probe.summarizeEvents(events, marker) as {
      traceWindowMs: number;
      marker: { threadName: string };
      mainThread: Record<
        string,
        { count: number; totalMs: number; selfMs: number }
      >;
      allThreads: Record<
        string,
        { count: number; totalMs: number; selfMs: number }
      >;
    };

    expect(probe.MARKER_NAME).toBe("shared-sheet-ab-real-more-click");
    expect(probe.TRACE_WINDOW_US).toBe(700_000);
    expect(summary.traceWindowMs).toBe(700);
    expect(summary.marker.threadName).toBe("CrRendererMain");
    expect(summary.mainThread.UpdateLayoutTree).toEqual({
      count: 1,
      totalMs: 0.1,
      selfMs: 0.07,
    });
    expect(summary.mainThread.Paint).toEqual({
      count: 1,
      totalMs: 0.05,
      selfMs: 0.05,
    });
    expect(summary.mainThread.Layout.count).toBe(0);
    expect(summary.mainThread.RasterTask.count).toBe(0);
    expect(summary.allThreads.RasterTask).toEqual({
      count: 1,
      totalMs: 0.08,
      selfMs: 0.08,
    });
  });

  it("applies the predeclared median and maximum duration conditions", () => {
    const run = (update: number, paint: number, raster: number) => ({
      trace: {
        mainThread: {
          UpdateLayoutTree: { totalMs: update },
          Paint: { totalMs: paint },
        },
        allThreads: {
          RasterTask: { totalMs: raster },
        },
      },
    });
    const baseline = [
      run(43.407, 28.319, 103.045),
      run(35.3, 17.075, 67.918),
      run(41.917, 16.205, 67.071),
    ];
    const candidate = [
      run(15.689, 4.517, 22.63),
      run(15.239, 2.463, 26.752),
      run(14.967, 4.169, 17.442),
    ];

    expect(probe.evaluateDurationAcceptance(baseline, candidate)).toEqual({
      UpdateLayoutTree: {
        baselineMedianMs: 41.917,
        ceilingMs: 20.9585,
        candidateMedianMs: 15.239,
        candidateMaximumMs: 15.689,
        medianPass: true,
        maximumPass: true,
        pass: true,
      },
      Paint: {
        baselineMedianMs: 17.075,
        ceilingMs: 8.5375,
        candidateMedianMs: 4.169,
        candidateMaximumMs: 4.517,
        medianPass: true,
        maximumPass: true,
        pass: true,
      },
      RasterTask: {
        baselineMedianMs: 67.918,
        ceilingMs: 33.959,
        candidateMedianMs: 22.63,
        candidateMaximumMs: 26.752,
        medianPass: true,
        maximumPass: true,
        pass: true,
      },
    });
  });

  it("locks the reproducible browser execution contract", () => {
    const source = readFileSync(probePath, "utf8");

    expect(probe.RUN_COUNT).toBe(3);
    expect(source).toContain('process.env.PLAYWRIGHT_BASE_URL');
    expect(source).toContain('process.env.AB_REVISION');
    expect(source).toContain('browser.version()');
    expect(source).toContain('await browser.newContext');
    expect(source).toContain('await page.mouse.click');
    expect(source).toContain('performance.mark(marker)');
    expect(source).toContain('console.log(JSON.stringify(output, null, 2))');
  });

  it("preserves the matched exploratory A/B records without overstating them", () => {
    const baseline = JSON.parse(
      readFileSync(
        evidencePath("shared-sheet-trace-baseline-fa1fc21.json"),
        "utf8"
      )
    );
    const candidate = JSON.parse(
      readFileSync(
        evidencePath("shared-sheet-trace-exploratory-3e4a5d1.json"),
        "utf8"
      )
    );

    expect(baseline.evidenceRole).toBe("exploratory-baseline");
    expect(candidate.evidenceRole).toBe("exploratory-candidate");
    expect(baseline.revision).toBe(
      "fa1fc216e424f1f2ac2bbd1cac7886253b24b922"
    );
    expect(candidate.revision).toBe(
      "3e4a5d192403d4a8f878eea64f06bc29fcf6c699"
    );
    expect(baseline.browserVersion).toBeNull();
    expect(candidate.browserVersion).toBeNull();
    expect(baseline.executedProbeSha256).toBeNull();
    expect(candidate.executedProbeSha256).toBeNull();
    const permanentProbeSha256 = createHash("sha256")
      .update(readFileSync(probePath))
      .digest("hex");
    expect(baseline.permanentProbe.sha256AtPreservation).toBe(
      permanentProbeSha256
    );
    expect(candidate.permanentProbe.sha256AtPreservation).toBe(
      permanentProbeSha256
    );
    expect(baseline.runs).toHaveLength(3);
    expect(candidate.runs).toHaveLength(3);
    expect(
      probe.evaluateDurationAcceptance(baseline.runs, candidate.runs)
    ).toEqual(candidate.exploratoryDurationComparison);
    expect(candidate.acceptanceStatus).toBe(
      "not-validated-requires-fresh-confirmatory-run"
    );
  });
});
