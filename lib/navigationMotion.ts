import { getRoleTransition } from "./motionSystem";

export const NAVIGATION_TABS = [
  "library",
  "reading",
  "settings",
] as const;

export type NavigationTab = (typeof NAVIGATION_TABS)[number];
export type NavigationSurfaceState = "before" | "active" | "after";

export const COMPACT_PUSH_OFFSETS = {
  incoming: 22,
  covered: -12,
} as const;

export const ROOT_TAB_OFFSETS = {
  outgoing: 6,
  incoming: 10,
} as const;

export function getCompactPushOffsets(direction: number) {
  return {
    covered: direction * COMPACT_PUSH_OFFSETS.covered,
    incoming: direction * COMPACT_PUSH_OFFSETS.incoming,
  };
}

export type PushMotionProfile = "depth" | "compact";

export function getPushMotionProfile(
  route: string | undefined
): PushMotionProfile {
  return route === "ai-provider-configure" ? "compact" : "depth";
}

export function getNavigationTabIndex(tab: NavigationTab): number {
  return NAVIGATION_TABS.indexOf(tab);
}

export function getNavigationSurfaceState(
  tab: NavigationTab,
  activeTab: NavigationTab
): NavigationSurfaceState {
  const difference =
    getNavigationTabIndex(tab) - getNavigationTabIndex(activeTab);
  if (difference === 0) return "active";
  return difference < 0 ? "before" : "after";
}

export function getRootTabOffsets(
  from: NavigationTab,
  to: NavigationTab
): { outgoing: number; incoming: number } {
  const direction = Math.sign(
    getNavigationTabIndex(to) - getNavigationTabIndex(from)
  );

  if (direction === 0) {
    return { outgoing: 0, incoming: 0 };
  }

  return {
    outgoing: -direction * ROOT_TAB_OFFSETS.outgoing,
    incoming: direction * ROOT_TAB_OFFSETS.incoming,
  };
}

export function getPushTransition(
  phase: "enter" | "exit",
  reduceMotion: boolean
) {
  return getRoleTransition(`push-${phase}`, reduceMotion);
}
