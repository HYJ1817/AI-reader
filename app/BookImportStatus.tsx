"use client";

import type { BookMetadata } from "@/lib/db";
import { getBookProgressPercent, type ReadingProgressMap } from "@/lib/libraryProgress";
import MotionSheet from "./MotionSheet";
import type useBookImport from "./useBookImport";
import styles from "./BookImportStatus.module.css";

const LABELS = { idle: "", reading: "正在读取文件…", parsing: "正在解析图书…", checking: "正在检查重复文件…", decision: "等待确认", saving: "正在保存，请稍候…", saved: "已导入" };

export default function BookImportStatus({ transfer, progressMap, onOpen, mode }: {
  transfer: ReturnType<typeof useBookImport>;
  progressMap: ReadingProgressMap;
  onOpen: (book: BookMetadata) => void;
  mode: "status" | "dialog";
}) {
  const existing = transfer.decision?.existing;
  if (transfer.stage === "idle" || (mode === "dialog") !== Boolean(transfer.decision)) return null;
  return <>
    {transfer.decision ? <div data-sheet-route="duplicate-import">
      <MotionSheet open onRequestClose={transfer.cancel} ariaLabel="导入确认" className={styles.panel}>
        <div className={styles.content}>
          <h2>{existing ? "这本书已在书库中" : "暂时无法检查重复文件"}</h2>
          <p>{transfer.fileName}</p>
          {existing ? <p>已有《{existing.title}》，阅读进度 {getBookProgressPercent(progressMap, existing.id)}%。打开已有书籍会保留进度、批注和对话。</p> : <p>尚未保存此文件。可以取消后重试，或明确选择仍然导入一份。</p>}
          <div className={styles.actions}>
            {existing && <button onClick={() => onOpen(existing)}>打开已有书籍</button>}
            <button onClick={() => void transfer.importAnother()}>{existing ? "另存一份" : "仍然导入一份"}</button>
            <button onClick={transfer.cancel}>取消</button>
          </div>
        </div>
      </MotionSheet>
    </div> : <section className={styles.status} aria-label="图书导入状态" aria-busy={transfer.busy}>
      <p role="status">{LABELS[transfer.stage]} · {transfer.fileName}</p>
      <div className={styles.actions}>
        {transfer.savedBook ? <><button onClick={() => onOpen(transfer.savedBook!)}>查看详情</button><button onClick={transfer.dismissStatus}>关闭导入提示</button></> : <button disabled={transfer.stage === "saving"} onClick={transfer.cancel}>取消导入</button>}
      </div>
    </section>}
  </>;
}
