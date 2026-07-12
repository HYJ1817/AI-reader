import { describe, expect, it } from "vitest";
import { MOTION_DURATION, MOTION_SPRING, getMotionPolicy } from "./motionSystem";

describe("motion system", () => {
  it("keeps exits faster than entrances", () => {
    expect(MOTION_DURATION.pushExit).toBeLessThan(MOTION_DURATION.pushEnter);
    expect(MOTION_DURATION.readerExit).toBeLessThan(MOTION_DURATION.readerEnter);
    expect(MOTION_DURATION.sheetExit).toBeLessThan(MOTION_DURATION.sheetEnter);
  });

  it("uses positive non-oscillating springs", () => {
    for (const spring of Object.values(MOTION_SPRING)) {
      expect(spring.stiffness).toBeGreaterThan(0);
      expect(spring.damping).toBeGreaterThan(30);
      expect(spring.mass).toBeGreaterThan(0);
      expect(spring.bounce).toBe(0);
    }
  });

  it("reduces motion for either preference", () => {
    expect(getMotionPolicy(false, false)).toBe("full");
    expect(getMotionPolicy(true, false)).toBe("reduced");
    expect(getMotionPolicy(false, true)).toBe("reduced");
  });
});
