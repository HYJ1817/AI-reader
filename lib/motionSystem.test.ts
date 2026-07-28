import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MOTION_DURATION,
  MOTION_EASE,
  MOTION_SPRING,
  REDUCED_MOTION_QUERY,
  ROOT_TAB_CONTENT_TRANSITION,
  ROOT_TAB_TRANSITION,
  createSystemMotionPreferenceStore,
  getRoleTransition,
  getMotionPolicy,
  getReaderTransitionTiming,
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
  it("defines one complete product duration role table", () => {
    expect(MOTION_DURATION).toEqual({
      press: 0.12,
      state: 0.16,
      stateExit: 0.12,
      tab: 0.22,
      rootTab: 0.16,
      pushEnter: 0.28,
      pushExit: 0.2,
      readerEnter: 0.28,
      readerExit: 0.21,
      sheetEnter: 0.28,
      sheetExit: 0.22,
      popoverEnter: 0.18,
      popoverExit: 0.12,
      chromeEnter: 0.16,
      chromeExit: 0.12,
      gestureSettle: 0.22,
      reduced: 0.1,
    });
  });

  it("uses the short indicator tween for root tab content", () => {
    expect(ROOT_TAB_CONTENT_TRANSITION).toEqual({
      type: "tween",
      duration: 0.16,
      ease: [0.22, 1, 0.36, 1],
    });
    expect(ROOT_TAB_TRANSITION).toEqual({
      type: "tween",
      duration: 0.22,
      ease: [0.22, 1, 0.36, 1],
    });
  });

  it("keeps exits faster than entrances", () => {
    expect(MOTION_DURATION.pushExit).toBeLessThan(MOTION_DURATION.pushEnter);
    expect(MOTION_DURATION.readerExit).toBeLessThan(MOTION_DURATION.readerEnter);
    expect(MOTION_DURATION.sheetExit).toBeLessThan(MOTION_DURATION.sheetEnter);
  });

  it("uses a fast reader exit without reusing entrance delay", () => {
    expect(MOTION_DURATION.readerEnter).toBe(0.28);
    expect(MOTION_DURATION.readerExit).toBe(0.21);
    expect(getReaderTransitionTiming(false)).toEqual({
      contentEnter: { duration: 0.16, delay: MOTION_DURATION.readerEnter * 0.24 },
      contentExit: { duration: 0.21, delay: 0 },
      coverEnterOpacity: {
        duration: 0.16,
        delay: MOTION_DURATION.readerEnter * 0.42,
      },
      coverExitOpacity: { duration: 0.21, delay: 0 },
    });
    expect(getReaderTransitionTiming(true)).toEqual({
      contentEnter: { duration: 0.1, delay: 0 },
      contentExit: { duration: 0.1, delay: 0 },
      coverEnterOpacity: { duration: 0.1, delay: 0 },
      coverExitOpacity: { duration: 0.1, delay: 0 },
    });
  });

  it("maps semantic roles to the approved tween durations and easing", () => {
    expect(MOTION_EASE).toEqual({
      enter: [0.22, 1, 0.36, 1],
      exit: [0.4, 0, 1, 1],
      settle: [0.32, 0.72, 0, 1],
    });

    expect(getRoleTransition("push-enter", false)).toEqual({
      type: "tween",
      duration: 0.28,
      ease: MOTION_EASE.enter,
    });
    expect(getRoleTransition("push-exit", false)).toEqual({
      type: "tween",
      duration: 0.2,
      ease: MOTION_EASE.exit,
    });
    expect(getRoleTransition("sheet-enter", false)).toEqual({
      type: "tween",
      duration: 0.28,
      ease: MOTION_EASE.enter,
    });
    expect(getRoleTransition("sheet-exit", false)).toEqual({
      type: "tween",
      duration: 0.22,
      ease: MOTION_EASE.exit,
    });
    expect(getRoleTransition("popover-enter", false)).toEqual({
      type: "tween",
      duration: 0.18,
      ease: MOTION_EASE.enter,
    });
    expect(getRoleTransition("popover-exit", false)).toEqual({
      type: "tween",
      duration: 0.12,
      ease: MOTION_EASE.exit,
    });
    expect(getRoleTransition("state-enter", false)).toEqual({
      type: "tween",
      duration: 0.16,
      ease: MOTION_EASE.enter,
    });
    expect(getRoleTransition("state-exit", false)).toEqual({
      type: "tween",
      duration: 0.12,
      ease: MOTION_EASE.exit,
    });

    for (const role of [
      "push-enter",
      "push-exit",
      "sheet-enter",
      "sheet-exit",
      "popover-enter",
      "popover-exit",
      "state-enter",
      "state-exit",
    ] as const) {
      expect(getRoleTransition(role, true)).toEqual({
        type: "tween",
        duration: 0.1,
        ease: role.endsWith("exit") ? MOTION_EASE.exit : MOTION_EASE.enter,
      });
    }
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
