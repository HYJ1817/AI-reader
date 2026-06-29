import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../app/ReadingGoalWheel.tsx", import.meta.url),
  "utf8"
);

describe("ReadingGoalWheel integration", () => {
  it("exposes an accessible bounded spinbutton", () => {
    expect(source).toContain('role="spinbutton"');
    expect(source).toContain("aria-valuemin={READING_GOAL_MIN_MINUTES}");
    expect(source).toContain("aria-valuemax={READING_GOAL_MAX_MINUTES}");
    expect(source).toContain("aria-valuenow={value}");
    expect(source).toContain("aria-valuetext={`${value} 分钟`}");
    expect(source).toContain("getReadingGoalWheelValues(value)");
  });

  it("supports keyboard, wheel, and pointer input", () => {
    expect(source).toContain("onKeyDown={handleKeyDown}");
    expect(source).toContain("onWheel={handleWheel}");
    expect(source).toContain("onPointerDown={handlePointerDown}");
    expect(source).toContain("onPointerMove={handlePointerMove}");
    expect(source).toContain("onPointerUp={finishPointerDrag}");
    expect(source).toContain("onPointerCancel={finishPointerDrag}");
    expect(source).toContain("setPointerCapture");
    expect(source).toContain("getReadingGoalWheelValueForKey");
  });

  it("keeps pointer dragging visually continuous between selected minutes", () => {
    expect(source).toContain("getReadingGoalWheelDragState");
    expect(source).toContain("setDragOffsetPx");
    expect(source).toContain("--goal-wheel-drag-offset");
    expect(source).toContain("goalWheelDragging");
  });

  it("renders only the bounded visible window", () => {
    expect(source).not.toContain("1440).map");
    expect(source).not.toContain("Array.from({ length: 1440");
    expect(source).toContain("visibleValues.map");
  });
});
