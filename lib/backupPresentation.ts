import type { RestorableBackupPayload } from "./backup";
import { CHANGED_READER_MESSAGE, STALE_READER_MESSAGE, LOCKED_READER_MESSAGE } from "./readerDataRevision";
import { UI_TEXT } from "./uiText";

export function buildBackupPreview(payload: RestorableBackupPayload) {
  return {
    version: payload.version,
    exportedAt: payload.exportedAt,
    bookCount: payload.books.length,
    annotationCount: payload.annotations.length,
    conversationCount: payload.version === 3 ? payload.workspaceSessions.length : 0,
    replacesWorkspace: true,
    replacesStatistics: payload.version !== 1,
    replacesBackground: payload.version !== 1,
    replacesProviders: payload.version !== 1,
    restoresLegacyAi: payload.version === 1 && Boolean(payload.aiSettings),
  };
}

export function getBackupErrorMessage(error: unknown): string {
  if (error instanceof SyntaxError) return "备份文件无法读取，可能已损坏。";
  const message = error instanceof Error ? error.message : "";
  if ([CHANGED_READER_MESSAGE, STALE_READER_MESSAGE, LOCKED_READER_MESSAGE, UI_TEXT.BACKUP_TOO_LARGE].includes(message)) return message;
  if (message === "backup-task-timeout") return "后台任务未能及时停止，书库未被替换。请稍后重试。";
  if (message === "Invalid backup: unsupported version") return "当前版本无法恢复这个备份，请先更新应用。";
  if (message.startsWith("Invalid backup")) return "这不是有效的 AI Reader 备份文件。";
  if (error instanceof Error && error.name === "QuotaExceededError") return "本机存储空间不足，未完成恢复。";
  return "恢复未完成，请重试。";
}

export async function waitForBackupTasks(tasks: Promise<unknown>[], timeoutMs = 10_000): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all(tasks),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("backup-task-timeout")), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}
