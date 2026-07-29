import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  createSheetCloseRequestGuard,
  shouldCommitSheetExit,
} from "./sheetPresentationState";

const bottomSheetSource = readFileSync(
  new URL("../app/BottomSheet.tsx", import.meta.url),
  "utf8"
);
const motionSheetUrl = new URL("../app/MotionSheet.tsx", import.meta.url);
const motionSheetSource = existsSync(motionSheetUrl)
  ? readFileSync(motionSheetUrl, "utf8")
  : "";
const librarySource = readFileSync(
  new URL("../app/LibrarySurface.tsx", import.meta.url),
  "utf8"
);
const aiSettingsUrl = new URL("../app/AiSettingsSurface.tsx", import.meta.url);
const aiSettingsSource = existsSync(aiSettingsUrl)
  ? readFileSync(aiSettingsUrl, "utf8")
  : "";
const overlaysSource = readFileSync(
  new URL("../app/AppOverlays.tsx", import.meta.url),
  "utf8"
);
const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);
const readerSettingsSource = readFileSync(
  new URL("../app/ReaderSettingsPanel.tsx", import.meta.url),
  "utf8"
);
const readingWorkspaceSource = readFileSync(
  new URL("../app/ReadingWorkspaceSheet.tsx", import.meta.url),
  "utf8"
);
const librarySheetPagesUrl = new URL(
  "../app/LibrarySheetPages.tsx",
  import.meta.url
);
const librarySheetPagesSource = existsSync(librarySheetPagesUrl)
  ? readFileSync(librarySheetPagesUrl, "utf8")
  : "";
const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

describe("overlay and nested view motion", () => {
  it("extracts reusable content-only workspace and library sheet pages", () => {
    const workspacePageSource = readingWorkspaceSource.slice(
      readingWorkspaceSource.indexOf("export function ReadingWorkspacePage")
    );

    expect(readingWorkspaceSource).toContain(
      "export function ReadingWorkspacePage"
    );
    expect(workspacePageSource).not.toContain("<BottomSheet");
    for (const page of [
      "BatchDeletePage",
      "BatchGroupPage",
      "BookActionPage",
      "BookDeletePage",
      "BookGroupPage",
      "BookRenamePage",
      "CollectionCreatePage",
    ]) {
      expect(librarySheetPagesSource).toContain(`function ${page}`);
      expect(librarySheetPagesSource).toMatch(
        new RegExp(`export \\{[\\s\\S]*?\\b${page}\\b[\\s\\S]*?\\};`)
      );
    }
    expect(librarySheetPagesSource).not.toContain("<BottomSheet");
    const renamePageSource = librarySheetPagesSource.slice(
      librarySheetPagesSource.indexOf("function BookRenamePage"),
      librarySheetPagesSource.indexOf("function BookDeletePage")
    );
    const renameFailure = renamePageSource.match(
      /catch \{([\s\S]*?)\n\s*\}/
    )?.[1] ?? "";
    const focusAfterCommit = renamePageSource.match(
      /useLayoutEffect\(\(\) => \{([\s\S]*?)\n\s*\}, \[[^\]]*error[^\]]*saving[^\]]*\]\);/
    )?.[1] ?? "";

    expect(renamePageSource).toContain(
      "requiredMessage = UI_TEXT.BOOK_TITLE_REQUIRED"
    );
    expect(renamePageSource).toContain("setError(requiredMessage)");
    expect(renamePageSource).toContain(
      'isSubmitKey = (event) => event.key === "Enter"'
    );
    expect(renamePageSource).toContain(
      "if (isSubmitKey(event) && !event.nativeEvent.isComposing)"
    );
    expect(renameFailure).toContain("setError(UI_TEXT.RENAME_BOOK_FAILED)");
    expect(renameFailure).toContain("setSaving(false)");
    expect(renameFailure).toContain("restoreFocusAfterFailureRef.current = true");
    expect(renameFailure).not.toContain("focus(");
    expect(focusAfterCommit).toContain("!saving");
    expect(focusAfterCommit).toContain("error === UI_TEXT.RENAME_BOOK_FAILED");
    expect(focusAfterCommit).toContain(
      "restoreFocusAfterFailureRef.current"
    );
    expect(focusAfterCommit).toContain(
      "inputRef.current?.focus({ preventScroll: true })"
    );
    expect(librarySheetPagesSource).toContain(
      'data-sheet-autofocus="true"'
    );
    expect(overlaysSource).toContain("<BookActionPage");
    expect(overlaysSource).toContain("<BookRenamePage");
    expect(overlaysSource).toContain("<CollectionCreatePage");
  });

  it("adapts the legacy sheet contract to one interruptible Motion owner", () => {
    expect(bottomSheetSource).toContain('import MotionSheet from "./MotionSheet"');
    expect(bottomSheetSource).toContain("<MotionSheet");
    expect(bottomSheetSource).toContain("open={open}");
    expect(bottomSheetSource).toContain("onRequestClose={() => setOpen(false)}");
    expect(bottomSheetSource).toContain("onExitComplete={onClose}");
    expect(motionSheetSource).toContain("AnimatePresence");
    expect(motionSheetSource).toContain("useMotionValue");
    expect(motionSheetSource).toContain("useTransform");
    expect(motionSheetSource).toContain('drag="y"');
    expect(motionSheetSource).toContain("dragControls");
    expect(motionSheetSource).toContain("shouldCompleteSheetDismiss");
    expect(motionSheetSource).toContain("setExitCommitGeneration");
    expect(motionSheetSource).toContain("useAppReducedMotion");
    expect(motionSheetSource).toContain("window.visualViewport");
    expect(motionSheetSource).toContain('viewport.addEventListener("resize"');
    expect(motionSheetSource).toContain('viewport.addEventListener("scroll"');
    expect(motionSheetSource).toContain("offsetTop: viewport.offsetTop");
    expect(motionSheetSource).toContain("height: viewport.height");
    expect(motionSheetSource).toContain("FOCUSABLE_SELECTOR");
    expect(motionSheetSource).toContain("previousFocusRef");
    expect(motionSheetSource).toContain("backgroundSiblingsRef");
    expect(motionSheetSource).toContain('[data-app-shell="true"]');
    expect(motionSheetSource).toContain("initialFocusRef?.current");
    expect(motionSheetSource).toContain('event.key !== "Tab"');
    expect(motionSheetSource).toContain("tabIndex={-1}");
    expect(motionSheetSource).toContain("sibling.inert = true");
    expect(motionSheetSource).toContain(
      "previousFocusRef.current?.isConnected"
    );
    expect(motionSheetSource).not.toContain("requestAnimationFrame");
    expect(motionSheetSource).not.toContain("setTimeout");
    expect(motionSheetSource).not.toContain("panel.style");
  });

  it("isolates sheet backdrop opacity from the transform-only panel", () => {
    expect(motionSheetSource).toContain(
      "className={styles.motionSheetBackdrop}"
    );
    expect(motionSheetSource).toContain("reduceMotion ? reducedOpacity : progress");
    expect(motionSheetSource).toContain('data-motion-sheet="backdrop"');
    expect(motionSheetSource).not.toContain("--sheet-backdrop-opacity");
    expect(motionSheetSource).not.toContain("initial={{ opacity: 0 }}");
    expect(motionSheetSource).not.toContain("animate={{ opacity: 1 }}");
    expect(motionSheetSource).not.toContain("exit={{ opacity: 0 }}");
    expect(motionSheetSource).toContain("exitRequestedRef");
    expect(motionSheetSource).toContain("activeAnimationRef.current?.stop()");
  });

  it("avoids forced layout while establishing cold-mount sheet geometry", () => {
    expect(motionSheetSource).toMatch(
      /const \[sheetHeight, setSheetHeight\] = useState\([^;]*window\.innerHeight/s
    );
    expect(motionSheetSource).toContain(
      'typeof window === "undefined" ? 900'
    );
    expect(motionSheetSource).toContain(
      "const y = useMotionValue(sheetHeight)"
    );
    expect(motionSheetSource).not.toContain("useMotionValue(900)");
    expect(motionSheetSource).toContain("entry?.borderBoxSize");
    expect(motionSheetSource).toContain("Array.isArray(borderBoxSize)");
    expect(motionSheetSource).toContain("borderBox.blockSize");

    const heightObserverEffect = motionSheetSource.match(
      /useEffect\(\(\) => \{[\s\S]*?new ResizeObserver\(\(entries\) => \{([\s\S]*?)\}\);[\s\S]*?observer\.observe\(panel\);[\s\S]*?\}, \[\]\);/
    );
    expect(heightObserverEffect).not.toBeNull();
    expect(heightObserverEffect?.[1]).toContain(
      "panel.getBoundingClientRect().height"
    );
    expect(motionSheetSource.match(/panel\.getBoundingClientRect\(\)/g)).toHaveLength(
      1
    );
    expect(motionSheetSource).not.toContain("updateHeight();");
  });

  it("initializes visual viewport state without a redundant mount update", () => {
    const viewportInitializer = motionSheetSource.match(
      /useState<VisualViewportFrame \| null>\(\(\) => \{([\s\S]*?)\n\s*\}\);/
    );
    expect(viewportInitializer).not.toBeNull();
    expect(viewportInitializer?.[1]).toContain('typeof window === "undefined"');
    expect(viewportInitializer?.[1]).toContain("window.visualViewport");

    const viewportEffect = motionSheetSource.match(
      /useEffect\(\(\) => \{[\s\S]*?const viewport = window\.visualViewport;([\s\S]*?)\}, \[\]\);/
    );
    expect(viewportEffect).not.toBeNull();
    expect(viewportEffect?.[1]).toContain(
      'viewport.addEventListener("resize", syncViewport)'
    );
    expect(viewportEffect?.[1]).toContain(
      'viewport.addEventListener("scroll", syncViewport)'
    );
    expect(viewportEffect?.[1]).not.toMatch(/\n\s*syncViewport\(\);/);
  });

  it("removes standalone keyframes from library and AI nested views", () => {
    for (const source of [librarySource, aiSettingsSource]) {
      expect(source).not.toContain("subviewEnterForward");
      expect(source).not.toContain("subviewEnterBackward");
    }

    expect(css).not.toContain(".subviewEnterForward");
    expect(css).not.toContain(".subviewEnterBackward");
    expect(css).not.toContain("@keyframes subviewInForward");
    expect(css).not.toContain("@keyframes subviewInBackward");
  });

  it("removes phase classes once Motion owns transforms and presence", () => {
    for (const legacy of [
      "motionSheetEntering",
      "motionSheetOpen",
      "motionSheetSettling",
      "motionSheetClosing",
      "motionSheetDragging",
    ]) {
      expect(bottomSheetSource + motionSheetSource).not.toContain(legacy);
      expect(css).not.toContain(`.${legacy}`);
    }
    for (const keyframe of [
      "sheetBackdropIn",
      "sheetSlideUp",
      "goalOverlayIn",
      "goalEditorIn",
    ]) {
      expect(css).not.toContain(`@keyframes ${keyframe}`);
    }
  });

  it("renders one persistent outer presentation around the full sheet stack", () => {
    expect(overlaysSource).toContain("useNavigation()");
    expect(overlaysSource).toContain("useNavigationState()");
    expect(overlaysSource).toContain("<MotionSheet");
    expect(overlaysSource).toContain("<SheetPageStack");
    expect(overlaysSource).toContain("entries={renderedEntries}");
    expect(overlaysSource).not.toContain("const sheet = sheets.at(-1)");
    expect(overlaysSource).not.toMatch(/case [\s\S]*?<BottomSheet/);
    expect(overlaysSource).toContain("data-sheet-route={topSheet.route}");
    expect(overlaysSource).toContain("data-sheet-stack-root={renderedEntries[0]?.route}");
    expect(motionSheetSource).toContain("open: boolean");
    expect(motionSheetSource).toContain("stackDepth?: number");
    expect(motionSheetSource).toContain("onRequestClose: () => void");
    expect(motionSheetSource).toContain("onExitComplete?: () => void");
    expect(motionSheetSource).toContain("useAppMotionLifecycle");
    expect(motionSheetSource).toContain("getRoleTransition");
    expect(motionSheetSource).toContain("data-sheet-stack-depth={stackDepth}");
    expect(motionSheetSource).toContain("lifecycle.epoch");
    expect(motionSheetSource).toContain("animationGenerationRef.current += 1");
    expect(motionSheetSource).toContain("completedExitGenerationRef.current");
    expect(motionSheetSource).toContain("onExitComplete?.()");
    expect(motionSheetSource).toContain("reduceMotion ? reducedOpacity : progress");
    expect(motionSheetSource).toContain("closeRequestGuardRef");
    expect(motionSheetSource).toContain("exitCommitGeneration");
    expect(motionSheetSource).not.toContain(
      "onExitComplete={finishClose}"
    );
    for (const route of [
      "reader-settings",
      "reader-custom-settings",
      "toc",
      "ask-ai",
      "reading-goal",
      "book-actions",
      "book-rename",
      "book-delete",
      "book-groups",
      "reading-workspace",
      "batch-groups",
      "batch-delete",
      "collection-create",
    ]) {
      expect(overlaysSource).toContain(`"${route}":`);
    }
  });

  it("keeps the first close callback and rejects duplicate same-tick requests", () => {
    const first = vi.fn();
    const second = vi.fn();
    const onRequestClose = vi.fn();
    const guard = createSheetCloseRequestGuard();
    const requestClose = (callback: () => void) => {
      if (!guard.request(callback)) return;
      onRequestClose();
    };

    requestClose(first);
    requestClose(second);
    expect(onRequestClose).toHaveBeenCalledOnce();
    guard.takeCallback()?.();
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
    expect(guard.takeCallback()).toBeNull();

    guard.reset();
    expect(guard.request(second)).toBe(true);
  });

  it("commits an exit only for the current closed generation", () => {
    expect(
      shouldCommitSheetExit({
        open: false,
        requestedGeneration: 4,
        currentGeneration: 4,
        completedGeneration: 3,
      })
    ).toBe(true);
    expect(
      shouldCommitSheetExit({
        open: true,
        requestedGeneration: 4,
        currentGeneration: 4,
        completedGeneration: 3,
      })
    ).toBe(false);
    expect(
      shouldCommitSheetExit({
        open: false,
        requestedGeneration: 4,
        currentGeneration: 5,
        completedGeneration: 3,
      })
    ).toBe(false);
    expect(
      shouldCommitSheetExit({
        open: false,
        requestedGeneration: 4,
        currentGeneration: 4,
        completedGeneration: 4,
      })
    ).toBe(false);
    expect(
      shouldCommitSheetExit({
        open: false,
        requestedGeneration: 4,
        currentGeneration: 4,
        completedGeneration: 5,
      })
    ).toBe(false);
  });

  it("promotes compositing only while the sheet is moving", () => {
    const runtimeCss = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const backdropRule = runtimeCss.match(/\.motionSheetBackdrop\s*\{[^}]*\}/s)?.[0] ?? "";
    const panelRule = runtimeCss.match(/\.motionSheetPanel\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(backdropRule).not.toContain("will-change");
    expect(panelRule).not.toContain("will-change");
    expect(motionSheetSource).toContain('willChange: isAnimating ? "opacity" : "auto"');
    expect(motionSheetSource).toContain('willChange: isAnimating ? "transform" : "auto"');
  });

  it("removes independent overlay-open booleans", () => {
    for (const stateName of [
      "readerSettingsOpen",
      "tocDrawerOpen",
      "askSheetOpen",
      "goalSheetOpen",
      "groupSheetOpen",
      "deleteConfirmOpen",
      "batchGroupSheetOpen",
      "batchDeleteConfirmOpen",
      "collectionCreateSheetOpen",
    ]) {
      expect(pageSource).not.toContain(`const [${stateName},`);
    }
    expect(readerSettingsSource).not.toContain("customSettingsOpen");
    expect(readerSettingsSource).toContain("onOpenCustomSettings");
  });
});
