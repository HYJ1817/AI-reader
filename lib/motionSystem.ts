export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export const MOTION_DURATION = {
  press: 0.12,
  state: 0.2,
  tab: 0.26,
  pushEnter: 0.36,
  pushExit: 0.27,
  readerEnter: 0.46,
  readerExit: 0.34,
  sheetEnter: 0.34,
  sheetExit: 0.25,
  reduced: 0.12,
} as const;

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
