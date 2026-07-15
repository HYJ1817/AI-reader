export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export const MOTION_DURATION = {
  press: 0.12,
  state: 0.2,
  tab: 0.26,
  pushEnter: 0.36,
  pushExit: 0.27,
  readerEnter: 0.3,
  readerExit: 0.22,
  sheetEnter: 0.34,
  sheetExit: 0.25,
  reduced: 0.12,
} as const;

export type ReaderTransitionTiming = {
  contentEnter: { duration: number; delay: number };
  contentExit: { duration: number; delay: number };
  coverEnterOpacity: { duration: number; delay: number };
  coverExitOpacity: { duration: number; delay: number };
};

export function getReaderTransitionTiming(
  reduceMotion: boolean
): ReaderTransitionTiming {
  const reduced = { duration: MOTION_DURATION.reduced, delay: 0 };
  if (reduceMotion) {
    return {
      contentEnter: reduced,
      contentExit: reduced,
      coverEnterOpacity: reduced,
      coverExitOpacity: reduced,
    };
  }

  return {
    contentEnter: {
      duration: MOTION_DURATION.state,
      delay: MOTION_DURATION.readerEnter * 0.24,
    },
    contentExit: { duration: MOTION_DURATION.readerExit, delay: 0 },
    coverEnterOpacity: {
      duration: MOTION_DURATION.state,
      delay: MOTION_DURATION.readerEnter * 0.42,
    },
    coverExitOpacity: { duration: MOTION_DURATION.readerExit, delay: 0 },
  };
}

export const MOTION_SPRING = {
  navigation: { type: "spring" as const, stiffness: 380, damping: 38, mass: 0.9, bounce: 0 },
  sheet: { type: "spring" as const, stiffness: 420, damping: 42, mass: 0.92, bounce: 0 },
  sharedBook: { type: "spring" as const, stiffness: 360, damping: 36, mass: 0.95, bounce: 0 },
} as const;

export type MotionPolicy = "full" | "reduced";

type MotionPreferenceListener = () => void;

export type SystemMotionMediaQuery = {
  readonly matches: boolean;
  addEventListener(type: "change", listener: MotionPreferenceListener): void;
  removeEventListener(type: "change", listener: MotionPreferenceListener): void;
};

export type SystemMotionMatchMedia = (
  query: string
) => SystemMotionMediaQuery;

export type SystemMotionPreferenceStore = {
  readonly getSnapshot: () => boolean;
  readonly subscribe: (listener: MotionPreferenceListener) => () => void;
};

const NO_SYSTEM_MOTION_PREFERENCE_STORE: SystemMotionPreferenceStore = {
  getSnapshot: () => false,
  subscribe: () => () => undefined,
};

export function getMotionPolicy(appPreference: boolean, systemPreference: boolean): MotionPolicy {
  return appPreference || systemPreference ? "reduced" : "full";
}

export function createSystemMotionPreferenceStore(
  matchMedia?: SystemMotionMatchMedia
): SystemMotionPreferenceStore {
  if (!matchMedia) return NO_SYSTEM_MOTION_PREFERENCE_STORE;

  const mediaQuery = matchMedia(REDUCED_MOTION_QUERY);

  return {
    getSnapshot: () => mediaQuery.matches,
    subscribe(listener) {
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    },
  };
}
