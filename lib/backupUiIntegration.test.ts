import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UI_TEXT } from "./uiText";

const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);
const settingsSource = readFileSync(
  new URL("../app/SettingsSurface.tsx", import.meta.url),
  "utf8"
);
const transferSource = readFileSync(new URL("../app/useBackupTransfer.ts", import.meta.url), "utf8");

describe("backup restore UI integration", () => {
  it("wires the confirmation controller to all background-task owners", () => {
    // Execution ordering is covered behaviorally in confirmedBackupRestore.test.ts.
    expect(pageSource).toContain("useBackupTransfer({");
    expect(pageSource).toContain("stopTasks: () => [flushWorkspacePersistence(), cancelBookCoverBackfillAndDrain(), metadataEnrichment.cancelAndDrain()]");
    expect(pageSource).toContain("stopReader: () => { navigation.dismissReader(); clearReaderBook(); }");
    expect(pageSource).toContain("<BackupRestoreSheet transfer={backupTransfer}");
    expect(transferSource).toContain("executeConfirmedBackupRestore({");
    expect(transferSource).toContain("acquireReaderRestoreLock(pending.revision)");
    expect(transferSource).toContain("await getReaderRestoreRevision()");
  });

  it("warns that backups contain passages and AI conversations", () => {
    expect(UI_TEXT.BACKUP_PRIVACY_HINT).toContain("选中文段");
    expect(UI_TEXT.BACKUP_PRIVACY_HINT).toContain("AI 对话");
    expect(settingsSource).toContain("UI_TEXT.BACKUP_PRIVACY_HINT");
  });
});
