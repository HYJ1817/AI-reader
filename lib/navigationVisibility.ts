export type NavigationTab = "library" | "reading" | "settings";

export function shouldShowBottomTabs(
  activeTab: NavigationTab,
  hasOpenBook: boolean
): boolean {
  if (activeTab === "reading" && hasOpenBook) return false;
  return ["library", "reading", "settings"].includes(activeTab);
}
