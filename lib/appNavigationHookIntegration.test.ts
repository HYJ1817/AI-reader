import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hookUrl = new URL("../app/useAppNavigation.ts", import.meta.url);
const providerUrl = new URL("../app/NavigationProvider.tsx", import.meta.url);
const hookSource = existsSync(hookUrl) ? readFileSync(hookUrl, "utf8") : "";
const providerSource = existsSync(providerUrl)
  ? readFileSync(providerUrl, "utf8")
  : "";

describe("app navigation hook integration", () => {
  it("provides the complete typed navigation command surface", () => {
    expect(hookSource).toContain('"use client"');
    expect(hookSource).toContain("export type UseAppNavigationResult");

    for (const command of [
      "selectTab",
      "push",
      "pop",
      "presentReader",
      "dismissReader",
      "presentSheet",
      "dismissSheet",
      "removeInvalid",
      "getState",
      "subscribe",
    ]) {
      expect(hookSource).toMatch(new RegExp(`\\b${command}\\b`));
    }
  });

  it("projects core navigation through an external store", () => {
    expect(hookSource).toContain("useSyncExternalStore");
    expect(hookSource).toContain("createAppNavigationStore");
    expect(hookSource).toContain("getState");
    expect(hookSource).toContain("subscribe");
    expect(hookSource).toContain("reduceAppNavigation(");
    expect(hookSource).toContain("mergeNavigationHistory(");
    expect(hookSource).not.toMatch(/\buseReducer\b/);
    expect(hookSource).toContain("state: AppNavigationCoreState");
  });

  it("uses replace, push, and browser traversal for their distinct roles", () => {
    expect(hookSource).toContain("window.history.replaceState");
    expect(hookSource).toContain("window.history.pushState");
    expect(hookSource).toContain("mergeNavigationHistory(");
    expect(hookSource).toContain("window.history.back()");
  });

  it("replaces a transient sheet when it presents the reader", () => {
    expect(hookSource).toContain("store.getState().sheets.length > 0");
    expect(hookSource).toContain('? "replace" : "push"');
  });

  it("restores valid popstate payloads and replaces invalid ones", () => {
    expect(hookSource).toContain('window.addEventListener("popstate"');
    expect(hookSource).toContain('window.removeEventListener("popstate"');
    expect(hookSource).toContain("decodeNavigationHistory(event.state)");
    expect(hookSource).toContain('type: "restore"');
    expect(hookSource).toContain("createAppNavigationState()");
  });

  it("exposes navigation through a guarded context", () => {
    expect(providerSource).toContain("NavigationContext.Provider");
    expect(providerSource).toContain("export function useNavigation");
    expect(providerSource).toContain("useNavigation requires NavigationProvider");
  });

  it("exposes sheets through their own full-state subscription", () => {
    expect(providerSource).toContain("useSyncExternalStore");
    expect(providerSource).toContain("export function useNavigationSheets");
    expect(providerSource).toContain("value.subscribe");
    expect(providerSource).toContain("value.getState().sheets");
  });
});
