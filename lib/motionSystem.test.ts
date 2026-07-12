import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MOTION_DURATION,
  MOTION_SPRING,
  REDUCED_MOTION_QUERY,
  createSystemMotionPreferenceStore,
  getMotionPolicy,
} from "./motionSystem";

const appMotionRootSource = readFileSync(
  new URL("../app/AppMotionRoot.tsx", import.meta.url),
  "utf8"
);

function createMatchMediaHarness(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<() => void>();
  const queries: string[] = [];

  return {
    matchMedia(query: string) {
      queries.push(query);
      return {
        get matches() {
          return matches;
        },
        addEventListener(type: "change", listener: () => void) {
          if (type === "change") listeners.add(listener);
        },
        removeEventListener(type: "change", listener: () => void) {
          if (type === "change") listeners.delete(listener);
        },
      };
    },
    setMatches(nextMatches: boolean) {
      matches = nextMatches;
      for (const listener of listeners) listener();
    },
    queries,
    listenerCount: () => listeners.size,
  };
}

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

describe("motion runtime root", () => {
  it("loads full DOM features and owns the reactive motion policy", () => {
    expect(appMotionRootSource).toContain("domMax");
    expect(appMotionRootSource).toContain(
      "<LazyMotion features={domMax} strict>"
    );
    expect(appMotionRootSource).toContain("useSyncExternalStore");
    expect(appMotionRootSource).toContain("useAppMotionPolicy");
    expect(appMotionRootSource).toContain("useAppReducedMotion");
    expect(appMotionRootSource).toContain('"always" : "never"');
    expect(appMotionRootSource).not.toContain("domAnimation");
    expect(appMotionRootSource).not.toMatch(/<(?:MotionConfig|LayoutGroup) key=/);
  });
});

describe("system motion preference store", () => {
  it("starts with the current preference and uses the reduced-motion query", () => {
    const harness = createMatchMediaHarness(true);
    const store = createSystemMotionPreferenceStore(harness.matchMedia);

    expect(REDUCED_MOTION_QUERY).toBe("(prefers-reduced-motion: reduce)");
    expect(harness.queries).toEqual([REDUCED_MOTION_QUERY]);
    expect(store.getSnapshot()).toBe(true);
  });

  it("notifies and reports a runtime false-to-true change", () => {
    const harness = createMatchMediaHarness(false);
    const store = createSystemMotionPreferenceStore(harness.matchMedia);
    const getSnapshot = store.getSnapshot;
    let notifications = 0;

    store.subscribe(() => {
      notifications += 1;
    });
    harness.setMatches(true);

    expect(notifications).toBe(1);
    expect(store.getSnapshot).toBe(getSnapshot);
    expect(store.getSnapshot()).toBe(true);
  });

  it("removes the change listener when unsubscribed", () => {
    const harness = createMatchMediaHarness(false);
    const store = createSystemMotionPreferenceStore(harness.matchMedia);
    let notifications = 0;
    const unsubscribe = store.subscribe(() => {
      notifications += 1;
    });

    expect(harness.listenerCount()).toBe(1);
    unsubscribe();
    expect(harness.listenerCount()).toBe(0);

    harness.setMatches(true);
    expect(notifications).toBe(0);
    expect(store.getSnapshot()).toBe(true);
  });

  it("returns a false no-op store without a browser matcher", () => {
    const store = createSystemMotionPreferenceStore();
    let notifications = 0;
    const unsubscribe = store.subscribe(() => {
      notifications += 1;
    });

    expect(store.getSnapshot()).toBe(false);
    expect(notifications).toBe(0);
    expect(() => unsubscribe()).not.toThrow();
  });
});
