import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UI_TEXT } from "./uiText";
import {
  MAX_BACKUP_IMPORT_BYTES,
  assertBackupImportSize,
} from "./backupImport";

const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);

describe("backup import size guard", () => {
  it("accepts a backup exactly at the 500 MiB limit", () => {
    expect(MAX_BACKUP_IMPORT_BYTES).toBe(500 * 1024 * 1024);
    expect(() => assertBackupImportSize(MAX_BACKUP_IMPORT_BYTES)).not.toThrow();
  });

  it("rejects a backup above the limit with localized copy", () => {
    expect(() => assertBackupImportSize(500 * 1024 * 1024 + 1)).toThrow(
      UI_TEXT.BACKUP_TOO_LARGE
    );
  });

  it("checks the file size before allocating backup text", () => {
    const guardIndex = pageSource.indexOf("assertBackupImportSize(file.size)");
    const readIndex = pageSource.indexOf("await file.text()", guardIndex);

    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(readIndex).toBeGreaterThan(guardIndex);
  });
});
