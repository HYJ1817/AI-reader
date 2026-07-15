export type ReaderChromeState = {
  visible: boolean;
  lastTapAt: number;
  discoveryPending: boolean;
};

export type ReaderChromeEvent =
  | { type: "tap"; at: number }
  | { type: "scroll"; at: number }
  | { type: "selection" }
  | { type: "hide" }
  | { type: "require-discovery" };

const RESIDUAL_SCROLL_SUPPRESSION_MS = 280;

export function createReaderChromeState(
  visible: boolean
): ReaderChromeState {
  return {
    visible,
    lastTapAt: Number.NEGATIVE_INFINITY,
    discoveryPending: false,
  };
}

export function reduceReaderChromeState(
  state: ReaderChromeState,
  event: ReaderChromeEvent
): ReaderChromeState {
  if (event.type === "require-discovery") {
    return state.discoveryPending && state.visible
      ? state
      : { ...state, visible: true, discoveryPending: true };
  }

  if (event.type === "tap") {
    return {
      visible: !state.visible,
      lastTapAt: event.at,
      discoveryPending: false,
    };
  }

  if (event.type === "scroll") {
    if (state.discoveryPending) return state;
    if (event.at - state.lastTapAt < RESIDUAL_SCROLL_SUPPRESSION_MS) {
      return state;
    }
    return state.visible ? { ...state, visible: false } : state;
  }

  if (event.type === "selection") {
    return state.visible ? state : { ...state, visible: true };
  }

  if (state.discoveryPending) return state;
  return state.visible ? { ...state, visible: false } : state;
}
