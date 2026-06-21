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
