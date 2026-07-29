import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globals = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8"
);
const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);
const library = readFileSync(
  new URL("../app/LibrarySurface.tsx", import.meta.url),
  "utf8"
);
const askAi = readFileSync(
  new URL("../app/WorkspaceConversation.tsx", import.meta.url),
  "utf8"
);
const settings = readFileSync(
  new URL("../app/SettingsSurface.tsx", import.meta.url),
  "utf8"
);
const messageBodyUrl = new URL(
  "../app/WorkspaceMessageBody.tsx",
  import.meta.url
);
const messageBody = existsSync(messageBodyUrl)
  ? readFileSync(messageBodyUrl, "utf8")
  : "";
const workspaceHook = readFileSync(
  new URL("../app/useWorkspaceChat.ts", import.meta.url),
  "utf8"
);
const artifactPreview = readFileSync(
  new URL("../app/WorkspaceArtifactPreview.tsx", import.meta.url),
  "utf8"
);
const motionSheet = readFileSync(
  new URL("../app/MotionSheet.tsx", import.meta.url),
  "utf8"
);
const sheetPageStack = readFileSync(
  new URL("../app/SheetPageStack.tsx", import.meta.url),
  "utf8"
);
const librarySheetPages = readFileSync(
  new URL("../app/LibrarySheetPages.tsx", import.meta.url),
  "utf8"
);
const readerSettingsPanel = readFileSync(
  new URL("../app/ReaderSettingsPanel.tsx", import.meta.url),
  "utf8"
);

function rule(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(
    new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`)
  );
  expect(match, `Missing CSS rule for ${selector}`).not.toBeNull();
  return match?.[1] ?? "";
}

describe("daily-path accessibility contract", () => {
  it("provides one visible keyboard focus language", () => {
    expect(globals).toContain("--focus-ring");
    expect(globals).toContain(":focus-visible");
    expect(globals).toMatch(/:focus-visible[^}]*outline:\s*3px solid var\(--focus-ring\)/s);
    expect(rule(css, ".tab:focus-visible")).not.toContain("outline: none");
  });

  it("uses native, separate Library controls with explicit view state", () => {
    expect(library).toContain('role="group"');
    expect(library).toContain("aria-pressed={view.mode === mode}");
    expect(library).toContain('data-library-book-open="true"');
    expect(library).toContain('data-library-book-more="true"');
    expect(library).toContain("className={styles.bookItemMain}");
  });

  it("names Ask AI actions and announces async state", () => {
    expect(askAi).toContain("className={styles.settingsPrompt}");
    expect(askAi).toContain("<button");
    expect(askAi).toContain("loading ? UI_TEXT.STOP : UI_TEXT.SEND");
    expect(askAi).toContain("<textarea");
    expect(askAi).toContain("!event.shiftKey");
    expect(askAi).toContain("!event.nativeEvent.isComposing");
    expect(askAi).toContain('role="status"');
    expect(askAi).toContain('role="alert"');
    expect(askAi).toContain('aria-busy={loading}');
    expect(settings).toContain('role="status"');
    expect(settings).toContain('role="alert"');
  });

  it("exposes explicit long-content and history controls", () => {
    expect(askAi).toContain("UI_TEXT.LOAD_OLDER");
    expect(messageBody).toContain("ReactMarkdown");
    expect(messageBody).toContain("remarkGfm");
    expect(messageBody).toContain("UI_TEXT.EXPAND");
    expect(messageBody).toContain("UI_TEXT.EXPORT");
    expect(askAi).toContain(
      "thread.scrollHeight - previousScrollHeight + previousScrollTop"
    );
    expect(workspaceHook).toContain("WORKSPACE_MESSAGE_PAGE_SIZE");
  });

  it("exposes bounded Skills and explicit local material actions", () => {
    expect(askAi).toContain("eligibleSkills.map");
    expect(askAi).toContain("UI_TEXT.SAVE_TO_MATERIALS");
    expect(rule(css, ".workspaceSkills button")).toContain("min-height: 44px");
    expect(artifactPreview).toContain("ReactMarkdown");
    expect(artifactPreview).toContain("UI_TEXT.COPY");
    expect(artifactPreview).toContain("UI_TEXT.EXPORT");
    expect(artifactPreview).toContain("UI_TEXT.RENAME");
    expect(artifactPreview).toContain("window.confirm");
  });

  it("uses scalable tokens on the stabilized daily path", () => {
    for (const token of [
      "--type-caption",
      "--type-footnote",
      "--type-body",
      "--type-headline",
      "--type-title",
    ]) {
      expect(globals).toContain(token);
    }
    expect(rule(css, ".libraryTitle")).toContain("var(--type-title)");
    expect(rule(css, ".bookTitle")).toContain("var(--type-body)");
    expect(rule(css, ".bookMeta")).toContain("var(--type-footnote)");
    expect(rule(css, ".tabLabel")).toContain("var(--type-caption)");
  });

  it("keeps frequent compact controls at least 44px", () => {
    for (const selector of [
      ".iconButton",
      ".libraryViewToggle button",
      ".bookGridMoreButton",
      ".bookMoreButton",
      ".clearSelectionButton",
      ".settingsActionRow button",
      ".groupAction",
      ".groupActionDelete",
      ".providerRefreshButton",
    ]) {
      const value = rule(css, selector);
      expect(value, selector).toMatch(/(?:width|min-width):\s*44px/);
      expect(value, selector).toMatch(/(?:height|min-height):\s*44px/);
    }
  });

  it("keeps one modal boundary and exposes only the active internal region", () => {
    expect(motionSheet).toContain('role="dialog"');
    expect(motionSheet).toContain('aria-modal="true"');
    expect(sheetPageStack).toContain('role="region"');
    expect(sheetPageStack).toContain(
      "aria-hidden={isActive ? undefined : true}"
    );
    expect(sheetPageStack).toContain("inert={isActive ? undefined : true}");
    expect(askAi).toContain('role="region"');
    expect(askAi).toContain(
      'aria-labelledby="workspace-memory-review-title"'
    );
    expect(askAi).not.toContain(
      'className={styles.workspaceMemoryReview} role="dialog"'
    );
    expect(askAi).not.toContain(
      'className={styles.workspaceMemoryReview} role="dialog" aria-modal="true"'
    );
  });

  it("coordinates keyboard visibility, lifecycle focus, and nested return focus", () => {
    expect(motionSheet).toContain(
      "window.innerHeight - viewport.height - viewport.offsetTop >= 120"
    );
    expect(motionSheet).toContain("interactiveTarget");
    expect(motionSheet).toContain("keyboardVisible");
    expect(motionSheet).toContain("onPointerCancel={settleCancelledDrag}");
    expect(motionSheet).toContain(
      "onLostPointerCapture={settleCancelledDrag}"
    );
    expect(sheetPageStack).toContain("useSheetPresentationMotion");
    expect(sheetPageStack).toContain("scrollIntoView({ block: \"nearest\" })");
    expect(sheetPageStack).toContain("lifecycle.epoch");
    expect(sheetPageStack).toContain("data-sheet-return-focus");
    for (const route of ["book-rename", "book-groups"]) {
      expect(librarySheetPages).toContain(`returnFocusFor="${route}"`);
    }
    expect(librarySheetPages).toContain(
      'data-sheet-return-focus="book-delete"'
    );
    expect(readerSettingsPanel).toContain(
      'data-sheet-return-focus="reader-custom-settings"'
    );
  });

  it("gives persistent pages sole initial focus ownership and traps Tab in the active page", () => {
    expect(motionSheet).toContain(
      'panel.querySelector("[data-sheet-page]")'
    );
    expect(motionSheet).toContain(
      '[data-sheet-page][data-sheet-page-active="true"]'
    );
    expect(motionSheet).toContain("focusScope.querySelectorAll<HTMLElement>");
    expect(motionSheet).toContain(
      'element.closest("[inert], [aria-hidden=\'true\']")'
    );

    const groupCreateRow = librarySheetPages.slice(
      librarySheetPages.indexOf("function GroupCreateRow"),
      librarySheetPages.indexOf("export function SheetHeader")
    );
    expect(groupCreateRow).not.toContain("autoFocus={autoFocus}");
    expect(groupCreateRow).toContain(
      'data-sheet-autofocus={autoFocus ? "true" : undefined}'
    );
  });

  it("focuses and announces memory review while isolating underlying workspace controls", () => {
    expect(askAi).toContain("memoryReviewTextareaRef");
    expect(askAi).toContain("memoryReviewTriggerRef");
    expect(askAi).toContain("memoryReviewTextareaRef.current?.focus");
    expect(askAi).toContain("trigger.focus({ preventScroll: true })");
    expect(askAi).toContain('aria-live="polite"');
    expect(askAi).toContain('aria-labelledby="workspace-memory-review-title"');
    expect(askAi).toContain('id="workspace-memory-review-title"');
    expect(askAi).toContain("aria-hidden={memoryReview ? true : undefined}");
    expect(askAi).toContain("inert={memoryReview ? true : undefined}");
    expect(askAi).toContain("ref={memoryReviewTextareaRef}");
  });
});
