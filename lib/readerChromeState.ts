export type ReaderChromeState = {
  visible: boolean;
  lastTapAt: number;
};

export type ReaderChromeEvent =
  | { type: "tap"; at: number }
  | { type: "scroll"; at: number }
  | { type: "selection" }
  | { type: "hide" };

const RESIDUAL_SCROLL_SUPPRESSION_MS = 280;

export function createReaderChromeState(
  visible: boolean
): ReaderChromeState {
  return {
    visible,
    lastTapAt: Number.NEGATIVE_INFINITY,
  };
}

export function reduceReaderChromeState(
  state: ReaderChromeState,
  event: ReaderChromeEvent
): ReaderChromeState {
  if (event.type === "tap") {
    return {
      visible: !state.visible,
      lastTapAt: event.at,
    };
  }

  if (event.type === "scroll") {
    if (event.at - state.lastTapAt < RESIDUAL_SCROLL_SUPPRESSION_MS) {
      return state;
    }
    return state.visible ? { ...state, visible: false } : state;
  }

  if (event.type === "selection") {
    return state.visible ? state : { ...state, visible: true };
  }

  return state.visible ? { ...state, visible: false } : state;
}
