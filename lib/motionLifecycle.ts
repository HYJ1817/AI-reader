export type MotionLifecycleState = {
  epoch: number;
  suspended: boolean;
};

export type MotionLifecycleEvent =
  | { type: "suspend" }
  | { type: "resume" }
  | { type: "viewport-change" };

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
