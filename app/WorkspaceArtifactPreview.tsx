"use client";

import { AnimatePresence, m } from "motion/react";
import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { triggerBlobDownload } from "@/lib/browserDownload";
import { getRoleTransition } from "@/lib/motionSystem";
import type { WorkspaceArtifactRecord } from "@/lib/readingWorkspace";
import { UI_TEXT } from "@/lib/uiText";
import { useAppReducedMotion } from "./AppMotionRoot";
import styles from "./page.module.css";

function safeFileName(title: string): string {
  const safe = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim();
  return `${safe || "reading-material"}.md`;
}

export default function WorkspaceArtifactPreview({
  artifact,
  onClose,
  onRename,
  onDelete,
}: {
  artifact: WorkspaceArtifactRecord;
  onClose: () => void;
  onRename: (id: string, title: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}) {
  const reduceMotion = useAppReducedMotion();
  const [title, setTitle] = useState(artifact.title);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const rename = async () => {
    if (!title.trim()) {
      setError(UI_TEXT.WORKSPACE_ARTIFACT_TITLE_REQUIRED);
      setStatus(null);
      return;
    }
    setError(null);
    setStatus(null);
    setSaving(true);
    try {
      await onRename(artifact.id, title.trim());
      setStatus("已重命名");
    } catch (renameError) {
      setError(
        renameError instanceof Error ? renameError.message : "重命名失败，请重试"
      );
      window.requestAnimationFrame(() =>
        titleInputRef.current?.focus({ preventScroll: true })
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={styles.workspaceArtifactPreview} aria-label={artifact.title}>
      <header>
        <input
          ref={titleInputRef}
          aria-label={UI_TEXT.WORKSPACE_ARTIFACT_TITLE}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button type="button" onClick={onClose}>{UI_TEXT.CLOSE}</button>
      </header>
      <div className={styles.workspaceArtifactStatusHost}>
        <AnimatePresence initial={false} mode="sync">
          {error ? (
            <m.div
              key="error"
              data-motion-role="inline-status"
              role="alert"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{
                opacity: 0,
                transition: getRoleTransition("state-exit", reduceMotion),
              }}
              transition={getRoleTransition("state-enter", reduceMotion)}
            >
              {error}
            </m.div>
          ) : saving || status ? (
            <m.div
              key={saving ? "saving" : "saved"}
              data-motion-role="inline-status"
              role="status"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{
                opacity: 0,
                transition: getRoleTransition("state-exit", reduceMotion),
              }}
              transition={getRoleTransition("state-enter", reduceMotion)}
            >
              {saving ? "正在保存…" : status}
            </m.div>
          ) : null}
        </AnimatePresence>
      </div>
      <div className={styles.workspaceMessageMarkdown}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{artifact.content}</ReactMarkdown>
      </div>
      <div className={styles.workspaceArtifactActions}>
        <button type="button" disabled={saving} onClick={() => void rename()}>
          {UI_TEXT.RENAME}
        </button>
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(artifact.content)}
        >
          {UI_TEXT.COPY}
        </button>
        <button
          type="button"
          onClick={() =>
            triggerBlobDownload(
              new Blob([artifact.content], { type: "text/markdown;charset=utf-8" }),
              safeFileName(artifact.title)
            )
          }
        >
          {UI_TEXT.EXPORT}
        </button>
        <button
          type="button"
          className={styles.workspaceDestructiveAction}
          onClick={() => {
            if (!window.confirm(UI_TEXT.WORKSPACE_DELETE_ARTIFACT_CONFIRM)) return;
            void Promise.resolve(onDelete(artifact.id)).then(onClose);
          }}
        >
          {UI_TEXT.DELETE}
        </button>
      </div>
    </section>
  );
}
