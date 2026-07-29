import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function optionalSource(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8").replace(/\r\n/g, "\n") : "";
}

const stackSource = optionalSource("../app/SheetPageStack.tsx");
const stylesSource = optionalSource("../app/page.module.css");

describe("measured internal sheet page stack", () => {
  it("keeps every keyed sheet entry mounted in synchronous presence", () => {
    expect(stackSource).toContain("entries.map((entry, index) =>");
    expect(stackSource).toContain("key={entry.key}");
    expect(stackSource).toContain("data-sheet-page");
    expect(stackSource).toContain("data-sheet-page-active={isActive}");
    expect(stackSource).toMatch(
      /<AnimatePresence[^>]*initial=\{false\}[^>]*mode="sync"/s
    );
    expect(stackSource).not.toContain(".at(-1)");
  });

  it("isolates covered pages from accessibility and pointer interaction", () => {
    expect(stackSource).toContain("aria-hidden={isActive ? undefined : true}");
    expect(stackSource).toContain("inert={isActive ? undefined : true}");
    expect(stackSource).toContain("tabIndex={-1}");
    const coveredRule = stylesSource.match(
      /\.sheetPage\[data-sheet-page-active="false"\]\s*\{[^}]*\}/s
    )?.[0] ?? "";
    expect(coveredRule).toContain("position: absolute");
    expect(coveredRule).toContain("top: 0");
    expect(coveredRule).toContain("left: 0");
    expect(coveredRule).toContain("right: 0");
    expect(coveredRule).toContain("pointer-events: none");
    expect(coveredRule).not.toContain("inset:");
    expect(coveredRule).not.toContain("bottom:");
  });

  it("uses direction-aware push roles, including the live exit direction", () => {
    expect(stackSource).toContain("custom={presenceContext}");
    expect(stackSource).toContain(
      'getSheetPageBoundary(context.direction, "exit", context.reduceMotion)'
    );
    expect(stackSource).toContain(
      'getRoleTransition("push-enter", reduceMotion)'
    );
    expect(stackSource).toContain(
      'getRoleTransition("push-exit", context.reduceMotion)'
    );
  });

  it("guards per-page back callbacks until that exact page exits", () => {
    expect(stackSource).toContain("pendingBackRef");
    expect(stackSource).toContain("intentGenerationRef");
    expect(stackSource).toContain("isExpectedBackRemoval");
    expect(stackSource).toContain("pending.key !== entryKey");
    expect(stackSource).toContain("onBack();");
    expect(stackSource).toContain("pending.afterBack?.();");
    expect(stackSource).toContain("back: isActive");
    expect(stackSource).toMatch(/back:\s*isActive[\s\S]*?:\s*\(\) => undefined/);
  });

  it("remeasures page heights and focuses only the guarded active page", () => {
    expect(stackSource).toContain("new ResizeObserver");
    expect(stackSource).toContain("useRef(new Map<string, number>())");
    expect(stackSource).toContain("bumpHeightVersion");
    expect(stackSource).toContain("lastActiveHeight");
    expect(stackSource).toContain("getSheetViewportHeight");
    expect(stackSource).toContain("onExitComplete");
    expect(stackSource).toContain("mountedRef.current");
    expect(stackSource).toContain("animate={{ height: viewportHeight }}");
    expect(stackSource).toContain('data-sheet-stack-depth={entries.length}');
    expect(stackSource).toContain('data-sheet-stack-direction={direction}');
    expect(stackSource).toContain('[data-sheet-autofocus="true"]');
    expect(stackSource).toContain("FOCUSABLE_SELECTOR");
    expect(stackSource).toContain("activePage.focus");
    expect(stackSource).toContain("hasMountedRef");
    expect(stackSource).toContain('typeof document !== "undefined"');
    expect(stackSource).toContain("activePage.contains(document.activeElement)");
    expect(stackSource).toContain("heights.get(entryKey) === height");
    expect(stackSource).toContain("activeMeasurementRef");
    expect(stackSource).toContain(
      "onHeightChange(entryKey, height, activeMeasurementRef.current)"
    );
    expect(stackSource).toContain(
      "lastMeasuredActiveHeightRef.current === height"
    );
    expect(stackSource).not.toContain(
      "activeEntryKeyRef.current === entryKey && height > 0"
    );
  });

  it("lets only the active page completion assign focus", () => {
    const viewportStart = stackSource.indexOf(
      "className={styles.sheetPageViewport}"
    );
    const presenceStart = stackSource.indexOf("<AnimatePresence", viewportStart);
    const viewportSource = stackSource.slice(viewportStart, presenceStart);

    expect(viewportSource).not.toContain("onAnimationComplete");
    expect(stackSource).toContain('if (definition === "exit")');
    expect(stackSource).toContain("if (isActive)");
    expect(stackSource).toContain("activeEntryKeyRef.current !== entryKey");
  });

  it("defines four isolated page-stack rules without permanent compositing hints", () => {
    expect(stylesSource).toMatch(
      /\.sheetPageViewport\s*\{[^}]*position:\s*relative;[^}]*width:\s*100%;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s
    );
    expect(stylesSource).toMatch(
      /\.sheetPage\s*\{[^}]*width:\s*100%;[^}]*min-height:\s*0;[^}]*transform:\s*translateZ\(0\);/s
    );
    expect(stylesSource).toMatch(
      /\.sheetPage\[data-sheet-page-active="true"\]\s*\{[^}]*position:\s*relative;/s
    );
    const stackRules = stylesSource.match(/\.sheetPage(?:Viewport|\[[^\n]+)?\s*\{[^}]*\}/g) ?? [];
    expect(stackRules).toHaveLength(4);
    expect(stackRules.join("\n")).not.toContain("will-change");
  });
});
