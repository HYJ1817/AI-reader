import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);
const overlaysSource = readFileSync(
  new URL("../app/AppOverlays.tsx", import.meta.url),
  "utf8"
);
const coordinatorSource = readFileSync(
  new URL("../app/PendingNavigationCoordinator.tsx", import.meta.url),
  "utf8"
);

describe("sheet navigation isolation", () => {
  it("keeps Home off the reactive sheet snapshot", () => {
    expect(pageSource).not.toContain("navigation.state.sheets");
    expect(pageSource).toContain("navigation.getState().sheets");
  });

  it("subscribes AppOverlays directly to sheet navigation", () => {
    expect(overlaysSource).toMatch(
      /import \{[^}]*useNavigationState[^}]*\} from "@\/app\/NavigationProvider"/s
    );
    expect(overlaysSource).toContain("const navigationState = useNavigationState()");
    expect(overlaysSource).toContain("const [visualEntries");
    expect(overlaysSource).toContain("navigationState.sheets.length > 0");
    expect(overlaysSource).toContain("navigation.dismissSheetStack");
    expect(overlaysSource).toContain("navigation.dismissSheet");
  });

  it("validates every book-backed sheet entry and removes the first invalid branch", () => {
    expect(overlaysSource).toContain("renderedEntries.find(");
    expect(overlaysSource).toContain("BOOK_ROUTES.has(entry.route)");
    expect(overlaysSource).toContain("navigation.removeInvalid(invalidEntry.key)");
    expect(overlaysSource).not.toContain("BOOK_ROUTES.has(sheet.route)");
  });

  it("isolates pending reader and settings navigation in a sheet subscriber", () => {
    expect(pageSource).toContain(
      'import PendingNavigationCoordinator from "@/app/PendingNavigationCoordinator"'
    );
    expect(coordinatorSource).toContain("useNavigationSheets()");
    expect(coordinatorSource).toContain("pendingPushAfterReaderRef.current");
    expect(coordinatorSource).toContain("pendingReaderTargetRef.current");
    expect(coordinatorSource).toContain("navigation.dismissReader()");
    expect(coordinatorSource).toContain('navigation.selectTab("settings")');
    expect(coordinatorSource).toContain("navigation.push(pendingPush)");
    expect(coordinatorSource).toContain("return null");
    expect(pageSource).toContain("<PendingNavigationCoordinator");
  });

  it("passes the active book id into group mutation actions", () => {
    expect(overlaysSource).toContain(
      "toggleBookGroup: (bookId: string, groupId: string) => void"
    );
    expect(overlaysSource).toContain("createGroup: (bookId: string) => void");
    expect(overlaysSource).toContain(
      "actions.toggleBookGroup(book.id, item.id)"
    );
    expect(overlaysSource).toContain("actions.createGroup(book.id)");
    expect(pageSource).not.toContain("groupSheetBook");
  });
});
