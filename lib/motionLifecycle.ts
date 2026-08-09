export type MotionLifecycleState = {
  epoch: number;
  suspended: boolean;
};

export type MotionLifecycleEvent =
  | { type: "suspend" }
  | { type: "resume" }
  | { type: "viewport-change" };

type MotionLifecycleEventTarget = {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
};

export type MotionLifecycleSubscriptionOptions = {
  windowTarget: MotionLifecycleEventTarget;
  documentTarget: MotionLifecycleEventTarget & { hidden: boolean };
  dispatch: (event: MotionLifecycleEvent) => void;
  getSuspended: () => boolean;
};

export function createMotionLifecycleState(): MotionLifecycleState {
  return { epoch: 0, suspended: false };
}

export function reduceMotionLifecycle(
  state: MotionLifecycleState,
  event: MotionLifecycleEvent
): MotionLifecycleState {
  if (event.type === "suspend") {
    return state.suspended
      ? state
      : { epoch: state.epoch + 1, suspended: true };
  }

  if (event.type === "resume") {
    return state.suspended
      ? { epoch: state.epoch + 1, suspended: false }
      : state;
  }

  return { epoch: state.epoch + 1, suspended: state.suspended };
}

export function subscribeMotionLifecycle({
  windowTarget,
  documentTarget,
  dispatch,
  getSuspended,
}: MotionLifecycleSubscriptionOptions): () => void {
  let suspended = getSuspended();
  let disposed = false;
  const suspend = () => {
    if (suspended) return;

    suspended = true;
    dispatch({ type: "suspend" });
  };
  const resume = () => {
    if (!suspended) return;

    suspended = false;
    dispatch({ type: "resume" });
  };
  const updateVisibility = () => {
    if (documentTarget.hidden) {
      suspend();
    } else {
      resume();
    }
  };
  const invalidateViewport = () => dispatch({ type: "viewport-change" });

  windowTarget.addEventListener("pagehide", suspend);
  windowTarget.addEventListener("pageshow", resume);
  documentTarget.addEventListener("visibilitychange", updateVisibility);
  windowTarget.addEventListener("orientationchange", invalidateViewport);
  updateVisibility();

  return () => {
    if (disposed) return;

    disposed = true;
    windowTarget.removeEventListener("pagehide", suspend);
    windowTarget.removeEventListener("pageshow", resume);
    documentTarget.removeEventListener("visibilitychange", updateVisibility);
    windowTarget.removeEventListener("orientationchange", invalidateViewport);
  };
}
