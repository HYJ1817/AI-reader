import { UI_TEXT } from "./uiText";

export const MAX_BACKUP_IMPORT_BYTES = 500 * 1024 * 1024;

export function assertBackupImportSize(size: number): void {
  if (size > MAX_BACKUP_IMPORT_BYTES) {
    throw new Error(UI_TEXT.BACKUP_TOO_LARGE);
  }
}
