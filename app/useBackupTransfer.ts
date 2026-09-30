"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { createBackupPayload, prepareBackupRestore, restorePreparedBackup, type PreparedBackupRestore } from "@/lib/backup";
import { acquireReaderRestoreLock, getReaderDataRevision, getReaderRestoreRevision, listAllAnnotations, listAllWorkspaceSessions, listBookMetadata } from "@/lib/db";
import { assertBackupImportSize } from "@/lib/backupImport";
import { buildBackupPreview, getBackupErrorMessage } from "@/lib/backupPresentation";
import { executeConfirmedBackupRestore } from "@/lib/confirmedBackupRestore";
import { triggerBlobDownload } from "@/lib/browserDownload";
import type { ReaderPositionCoordinator } from "@/lib/readerPositionCoordinator";
import { CHANGED_READER_MESSAGE } from "@/lib/readerDataRevision";
import { appUpdate } from "@/lib/appUpdate";
import useUpdateProtection from "./useUpdateProtection";
import { currentDataTransfer, tryAcquireDataTransfer } from "@/lib/localDataTransfer";

type PendingRestore = {
  prepared: PreparedBackupRestore;
  revision: number;
  fileName: string;
  current: { books: number; annotations: number; conversations: number };
};

export default function useBackupTransfer(options: {
  coordinator: ReaderPositionCoordinator;
  stopTasks: () => Promise<unknown>[];
  stopReader: () => void;
  reload: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(false);
  const releaseTransferRef = useRef<(() => void) | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingRestore | null>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  useUpdateProtection({ label: "备份导入或导出", busy, dirty: Boolean(pending) });

  function begin() {
    if (busyRef.current || appUpdate.getSnapshot().updating) return false;
    const release = tryAcquireDataTransfer("备份操作");
    if (!release) { setError(`${currentDataTransfer()}正在进行，请完成后重试。`); return false; }
    releaseTransferRef.current = release;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setStatus(null);
    setRestored(false);
    return true;
  }
  function finish() { releaseTransferRef.current?.(); releaseTransferRef.current = undefined; busyRef.current = false; setBusy(false); }

  async function select(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || pending || !begin()) return;
    setStatus("正在检查备份…");
    try {
      assertBackupImportSize(file.size);
      const prepared = prepareBackupRestore(JSON.parse(await file.text()));
      const before = await getReaderDataRevision();
      const [books, annotations, sessions] = await Promise.all([listBookMetadata(), listAllAnnotations(), listAllWorkspaceSessions()]);
      if ((await getReaderDataRevision()).revision !== before.revision) throw new Error(CHANGED_READER_MESSAGE);
      setPending({ prepared, revision: before.revision, fileName: file.name, current: { books: books.length, annotations: annotations.length, conversations: sessions.length } });
      setOpen(true);
    } catch (cause) { setError(getBackupErrorMessage(cause)); }
    finally { setStatus(null); finish(); }
  }

  async function exportBackup() {
    if (!begin()) return;
    try {
      const payload = await createBackupPayload();
      triggerBlobDownload(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), "ai-reader-backup.json");
      setStatus("已发起备份下载，请确认文件已保存。下载不会自动开始恢复。");
    } catch { setError("备份导出未完成，请重试。"); }
    finally { finish(); }
  }

  async function confirm() {
    if (!pending || !begin()) return;
    let committed = false;
    try {
      const result = await executeConfirmedBackupRestore({
        ...options,
        acquire: () => acquireReaderRestoreLock(pending.revision),
        restore: async () => {
          // The lock excludes other clients; authorized cancellation may save
          // partial AI output while draining and advance our own revision.
          const expectedRevision = await getReaderRestoreRevision();
          const result = await restorePreparedBackup(pending.prepared, { expectedRevision });
          committed = true;
          return result;
        },
      });
      setOpen(false);
      setRestored(true);
      const restoredMessage = `已恢复 ${pending.prepared.payload.books.length} 本图书。`;
      setStatus(result.configurationSaved ? restoredMessage : `${restoredMessage}但服务商配置保存失败。请在设置中重新配置，API Key 不会从备份恢复。`);
    } catch (cause) {
      if (committed) {
        setOpen(false);
        setError("书库已恢复，但页面刷新未完成。请重新打开应用；不要重复恢复。");
      } else {
        setOpen(false);
        setError(getBackupErrorMessage(cause));
      }
    } finally { finish(); }
  }

  return {
    inputRef, triggerRef, busy, open, status, error, restored, select, exportBackup, confirm,
    preview: pending ? { ...buildBackupPreview(pending.prepared.payload), fileName: pending.fileName, current: pending.current } : null,
    cancel: () => { if (!busyRef.current) { setOpen(false); setError(null); setStatus(null); } },
    finishClose: () => { setPending(null); requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true })); },
  };
}
