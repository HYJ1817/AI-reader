import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MOTION_DURATION } from "./motionSystem";

const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

function cssDuration(variable: string): number {
  const match = css.match(new RegExp(`${variable}:\\s*(\\d+)ms`));
  expect(match, `Missing CSS duration ${variable}`).not.toBeNull();
  return Number(match?.[1] ?? Number.NaN);
}

describe("motion duration CSS parity", () => {
  it("keeps mirrored CSS roles aligned with the TypeScript source", () => {
    expect(cssDuration("--motion-fast")).toBe(
      MOTION_DURATION.press * 1000
    );
    expect(cssDuration("--motion-standard")).toBe(
      MOTION_DURATION.state * 1000
    );
    expect(cssDuration("--motion-navigation")).toBe(
      MOTION_DURATION.pushEnter * 1000
    );
    expect(cssDuration("--motion-sheet")).toBe(
      MOTION_DURATION.sheetEnter * 1000
    );
    expect(cssDuration("--motion-sheet-settle")).toBe(
      MOTION_DURATION.gestureSettle * 1000
    );
    expect(cssDuration("--motion-sheet-exit")).toBe(
      MOTION_DURATION.sheetExit * 1000
    );
    expect(cssDuration("--motion-chrome-enter")).toBe(
      MOTION_DURATION.chromeEnter * 1000
    );
    expect(cssDuration("--motion-chrome-exit")).toBe(
      MOTION_DURATION.chromeExit * 1000
    );
  });
});
