export type NavigationTab = "library" | "reading" | "settings";

export function shouldShowBottomTabs(
  activeTab: NavigationTab,
  readerPresented: boolean
): boolean {
  if (readerPresented) return false;
  return ["library", "reading", "settings"].includes(activeTab);
}
