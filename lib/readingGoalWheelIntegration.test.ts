import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../app/ReadingGoalWheel.tsx", import.meta.url),
  "utf8"
);

describe("ReadingGoalWheel integration", () => {
  it("records the React Bits Option Wheel attribution", () => {
    expect(source).toContain("Derived from React Bits Option Wheel");
    expect(source).toContain("github.com/DavidHDev/react-bits");
    expect(source).toContain("THIRD_PARTY_NOTICES.md");
  });

  it("exposes an accessible controlled spinbutton", () => {
    expect(source).toContain('role="spinbutton"');
    expect(source).toContain("aria-valuemin={READING_GOAL_MIN_MINUTES}");
    expect(source).toContain("aria-valuemax={READING_GOAL_MAX_MINUTES}");
    expect(source).toContain("aria-valuenow={selectedValue}");
    expect(source).toContain("aria-valuetext={`${selectedValue} 分钟`}");
    expect(source).toContain("onChangeRef.current(nextValue)");
  });

  it("clamps nonfinite controlled values before synchronizing", () => {
    expect(source).not.toContain("if (!Number.isFinite(value)) return;");
    expect(source).toContain(
      "const nextValue = clampReadingGoalMinutes(value);"
    );
  });

  it("supports smoothed keyboard, wheel, and pointer input", () => {
    expect(source).toContain("onKeyDown={handleKeyDown}");
    expect(source).toContain("onPointerDown={handlePointerDown}");
    expect(source).toContain("onPointerMove={handlePointerMove}");
    expect(source).toContain("onPointerUp={finishPointerDrag}");
    expect(source).toContain("onPointerCancel={finishPointerDrag}");
    expect(source).toContain("setPointerCapture");
    expect(source).toContain("requestAnimationFrame(animate)");
    expect(source).toContain("getReadingGoalWheelAnimationMix");
    expect(source).toContain("getReadingGoalWheelDragTarget");
    expect(source).toContain("getReadingGoalWheelDeltaRows");
    expect(source).toContain(
      "wheelTimerRef.current = window.setTimeout"
    );
    expect(source).toContain(
      'matchMedia("(prefers-reduced-motion: reduce)")'
    );
  });

  it("installs a native non-passive wheel listener", () => {
    expect(source).toContain('addEventListener("wheel"');
    expect(source).toContain("passive: false");
    expect(source).toContain(
      'removeEventListener("wheel", handleWheel);'
    );
    expect(source).not.toContain("onWheel={handleWheel}");
  });

  it("queues rapid keyboard input from the current target", () => {
    expect(source).toContain(
      "getReadingGoalWheelSelectedValue(targetRef.current)"
    );
  });

  it("reconciles the latest controlled value once after local settling", () => {
    expect(source).toContain("controlledReconciliationGeneration");
    expect(source).toContain("requestControlledReconciliation");
    expect(source).toMatch(
      /localEchoValuesRef\.current\.clear\(\);[\s\S]*controlledReconciliationGeneration/
    );
    expect(source).toMatch(
      /useEffect\(\(\) => \{[\s\S]*isPostSettleReconciliation[\s\S]*\}, \[paintRows, value, controlledReconciliationGeneration\]\)/
    );
  });

  it("disables emitting callbacks synchronously during layout unmount", () => {
    expect(source).toMatch(
      /useLayoutEffect\(\(\) => \{\s*return \(\) => \{[\s\S]*mountedRef\.current = false;[\s\S]*animateRef\.current = null;[\s\S]*cancelAnimationFrame\(rafRef\.current\);[\s\S]*rafRef\.current = 0;[\s\S]*window\.clearTimeout\(wheelTimerRef\.current\);[\s\S]*wheelTimerRef\.current = null;[\s\S]*\};\s*\}, \[\]\);/
    );
  });

  it("settles safely when pointer capture is lost", () => {
    expect(source).toContain(
      "onLostPointerCapture={handleLostPointerCapture}"
    );
  });

  it("cleans up animation, wheel settling, and audio", () => {
    expect(source).toContain("cancelAnimationFrame(rafRef.current)");
    expect(source).toContain("window.clearTimeout(wheelTimerRef.current)");
    expect(source).toContain("audioRef.current?.pause()");
  });

  it("renders only the bounded 15-row virtual window", () => {
    expect(source).toContain("getReadingGoalWheelValues(renderCenter)");
    expect(source).toContain("visibleValues.map");
    expect(source).toContain('data-reading-goal-wheel="true"');
    expect(source).toContain('data-reading-goal-wheel-row="true"');
    expect(source).not.toMatch(/Array\.from\(\{\s*length:\s*1441/);
  });

  it("plays a rate-limited, nonessential selection tick", () => {
    expect(source).toContain('new Audio("/assets/sounds/click-soft.mp3")');
    expect(source).toContain("shouldPlayReadingGoalTick");
    expect(source).toContain("audio.volume = 0.5");
    expect(source).toContain("void audio.play().catch(() => undefined)");
  });
});
