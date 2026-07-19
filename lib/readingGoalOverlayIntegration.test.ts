import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const goalSource = readFileSync(
  new URL("../app/ReadingGoalSheet.tsx", import.meta.url),
  "utf8"
);
const overlaysSource = readFileSync(
  new URL("../app/AppOverlays.tsx", import.meta.url),
  "utf8"
);
const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);

describe("reading goal motion sheet", () => {
  it("uses the shared MotionSheet contract and the minute wheel", () => {
    expect(goalSource).toContain('import BottomSheet, { type CloseSheet } from "./BottomSheet"');
    expect(goalSource).toContain("<BottomSheet");
    expect(goalSource).toContain("styles.goalMotionSheet");
    expect(goalSource).toContain("showGrabber={false}");
    expect(goalSource).not.toContain('role="dialog"');
    expect(goalSource).not.toContain('aria-modal="true"');
    expect(goalSource).toContain("<ReadingGoalWheel");
    expect(goalSource).toContain('d="M22 180 A138 138 0 0 1 298 180"');
  });

  it("removes share and continue-reading actions", () => {
    expect(goalSource).not.toContain("onContinue");
    expect(goalSource).not.toContain("CONTINUE_READING");
    expect(goalSource).not.toContain("navigator.share");
    expect(goalSource).not.toContain("goalContinueButton");
  });

  it("discards drafts on close and saves only from confirmation", () => {
    expect(goalSource).toMatch(
      /<BottomSheet[\s\S]*onBeforeClose=\{\(\) =>[\s\S]*props\.onGoalInputChange\(props\.targetMinutes\)/
    );
    expect(goalSource).toMatch(
      /function saveTarget\(\)[\s\S]*onSaveGoal\(\);[\s\S]*setEditingTarget\(false\);/
    );
    expect(goalSource).toContain("onClick={() => closeSheet()}");
    expect(goalSource).not.toContain("handleDialogKeyDown");
  });

  it("traps focus and restores the opening control", () => {
    expect(goalSource).toContain("initialFocusRef={closeButtonRef}");
    expect(goalSource).not.toContain("previousFocusRef");
    expect(goalSource).not.toContain("querySelectorAll<HTMLElement>");
    expect(goalSource).not.toContain("document.addEventListener");
  });
});

describe("reading goal orchestration", () => {
  const goalMount =
    overlaysSource.match(
      /case "reading-goal":[\s\S]*?<ReadingGoalSheet[\s\S]*?\/>/
    )?.[0] ?? "";

  it("keeps the goal overlay mounted through AppOverlays", () => {
    expect(goalMount).toContain("todayMinutes={reader.todayMinutes}");
    expect(goalMount).toContain("targetMinutes={reader.targetMinutes}");
    expect(goalMount).toContain("goalInputValue={reader.goalInputValue}");
    expect(goalMount).toContain(
      "onGoalInputChange={actions.setGoalInputValue}"
    );
    expect(goalMount).toContain("onSaveGoal={actions.saveGoal}");
    expect(goalMount).toContain("onClose={navigation.dismissSheet}");
  });

  it("does not pass obsolete goal-only props", () => {
    expect(goalMount).not.toContain("bookTitle=");
    expect(goalMount).not.toContain("onContinue=");
  });

  it("keeps persistence in page orchestration", () => {
    expect(pageSource).toMatch(
      /function handleOpenGoalSheet\(\)[\s\S]*setGoalInputValue\(readingGoal\.targetMinutes\);[\s\S]*navigation\.presentSheet\("reading-goal"\);/
    );
    expect(pageSource).toMatch(
      /function handleSaveGoal\(\)[\s\S]*saveReadingGoalToStorage\(sanitized\);[\s\S]*setReadingGoal\(saved\);/
    );
    expect(pageSource).not.toMatch(
      /setGoalInputValue:\s*\([^)]*\)\s*=>\s*saveReadingGoalToStorage/
    );
  });
});
