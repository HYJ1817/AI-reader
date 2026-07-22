import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);

describe("backup restore UI integration", () => {
  it("quiesces and clears stale reader state before replacing the library", () => {
    const guardIndex = pageSource.indexOf("await runBackupRestoreGuarded({");
    const restoreIndex = pageSource.indexOf("await restoreBackupPayload(data)");
    const dismissIndex = pageSource.indexOf("navigation.dismissReader()", guardIndex);
    const clearIndex = pageSource.indexOf("clearReaderBook();", guardIndex);
    const resetIndex = pageSource.indexOf("resetAskAi();", guardIndex);
    const successIndex = pageSource.indexOf(
      "setBackupStatus(UI_TEXT.BACKUP_RESTORED)",
      restoreIndex
    );

    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(restoreIndex).toBeGreaterThanOrEqual(0);
    expect(dismissIndex).toBeGreaterThan(guardIndex);
    expect(clearIndex).toBeGreaterThan(dismissIndex);
    expect(resetIndex).toBeGreaterThan(clearIndex);
    expect(resetIndex).toBeLessThan(successIndex);
    expect(restoreIndex).toBeGreaterThan(resetIndex);
  });
});
