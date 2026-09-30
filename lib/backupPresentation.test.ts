import { describe, expect, it } from "vitest";
import { buildBackupPreview, getBackupErrorMessage } from "./backupPresentation";
import type { LegacyBackupPayload } from "./backup";

describe("backup restore presentation", () => {
  const payload: LegacyBackupPayload = { version: 1, exportedAt: "2026-09-18T00:00:00Z", books: [], readingPositions: [], annotations: [] };
  it("exposes empty and legacy destructive effects before commit", () => {
    expect(buildBackupPreview(payload)).toMatchObject({ bookCount: 0, annotationCount: 0, conversationCount: 0, replacesWorkspace: true, replacesStatistics: false, replacesBackground: false });
  });
  it("does not leak internal parsing or validation errors", () => {
    expect(getBackupErrorMessage(new SyntaxError("private filename"))).toBe("备份文件无法读取，可能已损坏。");
    expect(getBackupErrorMessage(new Error("Invalid backup: unsupported version"))).toContain("更新应用");
    expect(getBackupErrorMessage(new Error("internal database secret"))).not.toContain("secret");
  });
  it("does not promise modern provider replacement for legacy API settings", () => {
    expect(buildBackupPreview({ ...payload, aiSettings: { baseUrl: "https://example.test", model: "legacy" } })).toMatchObject({ replacesProviders: false, restoresLegacyAi: true });
  });
});
