"use client";

import MotionSheet from "./MotionSheet";
import type useBackupTransfer from "./useBackupTransfer";
import styles from "./BackupRestoreSheet.module.css";

export default function BackupRestoreSheet({ transfer }: { transfer: ReturnType<typeof useBackupTransfer> }) {
  const preview = transfer.preview;
  if (!preview) return null;
  const exported = new Date(preview.exportedAt);
  return (
    <div data-sheet-route="backup-restore">
      <MotionSheet open={transfer.open} dismissible={!transfer.busy} onRequestClose={transfer.cancel} onExitComplete={transfer.finishClose} ariaLabel="恢复备份确认" className={styles.panel} showGrabber={!transfer.busy}>
        <div className={styles.content} aria-busy={transfer.busy}>
          <h2>恢复这个备份？</h2>
          <p className={styles.file}>{preview.fileName}</p>
          <p>导出时间：{Number.isNaN(exported.getTime()) ? "未知" : exported.toLocaleString("zh-CN")} · v{preview.version}</p>
          <dl className={styles.counts}>
            <div><dt>备份内</dt><dd>{preview.bookCount} 本书 · {preview.annotationCount} 条批注 · {preview.conversationCount} 个对话</dd></div>
            <div><dt>当前本机</dt><dd>{preview.current.books} 本书 · {preview.current.annotations} 条批注 · {preview.current.conversations} 个对话</dd></div>
          </dl>
          <p className={styles.warning}>这会替换本机书库、阅读进度、批注和分组，不会合并。请先关闭其他标签页和已安装的旧版应用。</p>
          {preview.bookCount === 0 && <p className={styles.warning}>这是空备份：确认后会清空当前书库。</p>}
          <ul>
            <li>{preview.version < 3 ? "旧版备份不含工作区，当前 AI 对话、资料与记忆会被清空。" : "AI 对话、工作区资料与记忆将被替换。"}</li>
            <li>{preview.replacesStatistics ? "阅读统计与自定义背景将被替换。" : "阅读统计与自定义背景保持不变。"}</li>
            <li>{preview.replacesProviders ? "服务商配置将恢复，但不包含 API Key；需要重新填写。" : preview.restoresLegacyAi ? "旧备份仅恢复旧版 API 地址和模型（不含密钥），不会替换新版服务商列表。" : "服务商配置保持不变。"}</li>
          </ul>
          {transfer.status && <p role="status">{transfer.status}</p>}
          {transfer.error && <p role="alert">{transfer.error}</p>}
          {transfer.busy && <p role="status">正在处理，请勿关闭应用…</p>}
          <div className={styles.actions}>
            <button disabled={transfer.busy} onClick={transfer.cancel}>取消</button>
            <button disabled={transfer.busy} onClick={() => void transfer.exportBackup()}>先导出当前备份</button>
            <button className={styles.destructive} disabled={transfer.busy} onClick={() => void transfer.confirm()}>替换并恢复</button>
          </div>
        </div>
      </MotionSheet>
    </div>
  );
}
