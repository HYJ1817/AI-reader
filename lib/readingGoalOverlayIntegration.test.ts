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

describe("reading goal fullscreen overlay", () => {
  it("uses a dedicated modal dialog and the minute wheel", () => {
    expect(goalSource).not.toContain('import BottomSheet from "./BottomSheet"');
    expect(goalSource).not.toContain("<BottomSheet");
    expect(goalSource).toContain('role="dialog"');
    expect(goalSource).toContain('aria-modal="true"');
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
      /const closeGoal = useCallback\(\(\) => \{[\s\S]*onGoalInputChange\(targetMinutes\);[\s\S]*onClose\(\);/
    );
    expect(goalSource).toMatch(
      /function saveTarget\(\)[\s\S]*onSaveGoal\(\);[\s\S]*setEditingTarget\(false\);/
    );
    expect(goalSource).toContain("if (event.key === \"Escape\")");
    expect(goalSource).toContain("closeGoal();");
  });

  it("traps focus and restores the opening control", () => {
    expect(goalSource).toContain("previousFocusRef");
    expect(goalSource).toContain("querySelectorAll<HTMLElement>");
    expect(goalSource).toContain("event.shiftKey");
    expect(goalSource).toContain("previousFocusRef.current?.focus()");
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
