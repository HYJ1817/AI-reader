export const NAVIGATION_TABS = [
  "library",
  "reading",
  "settings",
] as const;

export type NavigationTab = (typeof NAVIGATION_TABS)[number];
export type NavigationSurfaceState = "before" | "active" | "after";

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
    outgoing: direction * -12,
    incoming: direction * 22,
  };
}
