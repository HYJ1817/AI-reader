import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);

describe("backup restore UI integration", () => {
  it("clears stale reader and AI state after replacing the library", () => {
    const restoreIndex = pageSource.indexOf("await restoreBackupPayload(data)");
    const resetIndex = pageSource.indexOf("resetAskAi();", restoreIndex);
    const successIndex = pageSource.indexOf(
      "setBackupStatus(UI_TEXT.BACKUP_RESTORED)",
      restoreIndex
    );

    expect(restoreIndex).toBeGreaterThanOrEqual(0);
    expect(pageSource.indexOf("setOpenBook(null);", restoreIndex)).toBeLessThan(
      successIndex
    );
    expect(pageSource.indexOf("setParagraphs([]);", restoreIndex)).toBeLessThan(
      successIndex
    );
    expect(resetIndex).toBeGreaterThan(restoreIndex);
    expect(resetIndex).toBeLessThan(successIndex);
  });
});
