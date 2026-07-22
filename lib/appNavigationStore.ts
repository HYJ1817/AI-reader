import type { AppNavigationState } from "./appNavigation";

export type AppNavigationCoreState = Pick<
  AppNavigationState,
  "activeTab" | "pushes" | "reader"
>;

type Listener = () => void;

export type AppNavigationStore = {
  getState: () => AppNavigationState;
  getCoreSnapshot: () => AppNavigationCoreState;
  setState: (nextState: AppNavigationState) => void;
  subscribe: (listener: Listener) => () => void;
  subscribeCore: (listener: Listener) => () => void;
};

function createCoreSnapshot(
  state: AppNavigationState
): AppNavigationCoreState {
  return {
    activeTab: state.activeTab,
    pushes: state.pushes,
    reader: state.reader,
  };
}

export function createAppNavigationStore(
  initialState: AppNavigationState
): AppNavigationStore {
  let state = initialState;
  let coreSnapshot = createCoreSnapshot(initialState);
  const listeners = new Set<Listener>();
  const coreListeners = new Set<Listener>();

  const getState = () => state;
  const getCoreSnapshot = () => coreSnapshot;

  const setState = (nextState: AppNavigationState) => {
    if (nextState === state) return;

    const coreChanged =
      nextState.activeTab !== state.activeTab ||
      nextState.pushes !== state.pushes ||
      nextState.reader !== state.reader;
    state = nextState;

    if (coreChanged) {
      coreSnapshot = createCoreSnapshot(nextState);
    }

    listeners.forEach((listener) => listener());
    if (coreChanged) {
      coreListeners.forEach((listener) => listener());
    }
  };

  const subscribe = (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const subscribeCore = (listener: Listener) => {
    coreListeners.add(listener);
    return () => {
      coreListeners.delete(listener);
    };
  };

  return {
    getState,
    getCoreSnapshot,
    setState,
    subscribe,
    subscribeCore,
  };
}
