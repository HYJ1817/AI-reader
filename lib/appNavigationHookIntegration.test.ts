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
    ]) {
      expect(hookSource).toMatch(new RegExp(`\\b${command}\\b`));
    }
  });

  it("projects commands through one reducer-backed state ref", () => {
    expect(hookSource).toMatch(/useReducer\(\s*reduceAppNavigation/);
    expect(hookSource).toContain("stateRef");
    expect(hookSource).toContain("reduceAppNavigation(stateRef.current, action)");
    expect(hookSource).toContain("encodeNavigationHistory(nextState)");
  });

  it("uses replace, push, and browser traversal for their distinct roles", () => {
    expect(hookSource).toContain("window.history.replaceState");
    expect(hookSource).toContain("window.history.pushState");
    expect(hookSource).toContain("window.history.back()");
  });

  it("replaces a transient sheet when it presents the reader", () => {
    expect(hookSource).toContain("stateRef.current.sheets.length > 0");
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
});
