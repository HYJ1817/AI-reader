import { describe, expect, it } from "vitest";
import {
  createMotionLifecycleState,
  reduceMotionLifecycle,
  subscribeMotionLifecycle,
} from "./motionLifecycle";

function createEventTarget() {
  const listeners = new Map<string, Set<() => void>>();
  const added: Array<{ type: string; listener: () => void }> = [];
  const removed: Array<{ type: string; listener: () => void }> = [];

  return {
    addEventListener(type: string, listener: () => void) {
      added.push({ type, listener });
      const eventListeners = listeners.get(type) ?? new Set();
      eventListeners.add(listener);
      listeners.set(type, eventListeners);
    },
    removeEventListener(type: string, listener: () => void) {
      removed.push({ type, listener });
      listeners.get(type)?.delete(listener);
    },
    emit(type: string) {
      for (const listener of listeners.get(type) ?? []) listener();
    },
    listenerCount() {
      return [...listeners.values()].reduce((count, eventListeners) => count + eventListeners.size, 0);
    },
    added,
    removed,
  };
}

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

  it("binds lifecycle events to their targets and settles duplicate lifecycle signals", () => {
    const windowTarget = createEventTarget();
    const documentTarget = { ...createEventTarget(), hidden: true };
    let state = createMotionLifecycleState();
    const dispatched: string[] = [];
    const cleanup = subscribeMotionLifecycle({
      windowTarget,
      documentTarget,
      dispatch(event) {
        dispatched.push(event.type);
        state = reduceMotionLifecycle(state, event);
      },
      getSuspended: () => state.suspended,
    });

    expect(windowTarget.added.map(({ type }) => type)).toEqual([
      "pagehide",
      "pageshow",
      "orientationchange",
    ]);
    expect(documentTarget.added.map(({ type }) => type)).toEqual(["visibilitychange"]);
    expect(state).toEqual({ epoch: 1, suspended: true });

    windowTarget.emit("pagehide");
    documentTarget.emit("visibilitychange");
    expect(dispatched).toEqual(["suspend"]);

    documentTarget.hidden = false;
    documentTarget.emit("visibilitychange");
    windowTarget.emit("pageshow");
    expect(state).toEqual({ epoch: 2, suspended: false });
    expect(dispatched).toEqual(["suspend", "resume"]);

    windowTarget.emit("orientationchange");
    expect(state).toEqual({ epoch: 3, suspended: false });

    cleanup();
    cleanup();
    expect(windowTarget.listenerCount()).toBe(0);
    expect(documentTarget.listenerCount()).toBe(0);
    expect(windowTarget.removed).toEqual(windowTarget.added);
    expect(documentTarget.removed).toEqual(documentTarget.added);

    windowTarget.emit("pagehide");
    documentTarget.hidden = true;
    documentTarget.emit("visibilitychange");
    expect(state).toEqual({ epoch: 3, suspended: false });
  });

  it("does not duplicate listeners or dispatches across a StrictMode-style rebind", () => {
    const windowTarget = createEventTarget();
    const documentTarget = { ...createEventTarget(), hidden: true };
    let state = createMotionLifecycleState();
    let dispatches = 0;
    const options = {
      windowTarget,
      documentTarget,
      dispatch(event: Parameters<typeof reduceMotionLifecycle>[1]) {
        dispatches += 1;
        state = reduceMotionLifecycle(state, event);
      },
      getSuspended: () => state.suspended,
    };

    const firstCleanup = subscribeMotionLifecycle(options);
    firstCleanup();
    const secondCleanup = subscribeMotionLifecycle(options);

    expect(dispatches).toBe(1);
    expect(windowTarget.listenerCount()).toBe(3);
    expect(documentTarget.listenerCount()).toBe(1);

    secondCleanup();
    expect(windowTarget.listenerCount()).toBe(0);
    expect(documentTarget.listenerCount()).toBe(0);
  });
});
