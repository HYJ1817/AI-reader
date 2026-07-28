import { describe, expect, it } from "vitest";
import {
  createMotionLifecycleState,
  reduceMotionLifecycle,
} from "./motionLifecycle";

describe("motion lifecycle", () => {
  it("suspends once and resumes once", () => {
    const initial = createMotionLifecycleState();
    const suspended = reduceMotionLifecycle(initial, { type: "suspend" });

    expect(initial).toEqual({ epoch: 0, suspended: false });
    expect(suspended).toEqual({ epoch: 1, suspended: true });
    expect(reduceMotionLifecycle(suspended, { type: "suspend" })).toBe(suspended);

    const resumed = reduceMotionLifecycle(suspended, { type: "resume" });
    expect(resumed).toEqual({ epoch: 2, suspended: false });
  });

  it("invalidates the viewport without changing suspension", () => {
    expect(
      reduceMotionLifecycle(createMotionLifecycleState(), {
        type: "viewport-change",
      })
    ).toEqual({ epoch: 1, suspended: false });
  });
});
