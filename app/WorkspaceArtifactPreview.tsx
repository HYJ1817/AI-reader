"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { triggerBlobDownload } from "@/lib/browserDownload";
import type { WorkspaceArtifactRecord } from "@/lib/readingWorkspace";
import { UI_TEXT } from "@/lib/uiText";
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
  const [title, setTitle] = useState(artifact.title);
  const [error, setError] = useState<string | null>(null);

  const rename = async () => {
    if (!title.trim()) {
      setError(UI_TEXT.WORKSPACE_ARTIFACT_TITLE_REQUIRED);
      return;
    }
    setError(null);
    await onRename(artifact.id, title);
  };

  return (
    <section className={styles.workspaceArtifactPreview} aria-label={artifact.title}>
      <header>
        <input
          aria-label={UI_TEXT.WORKSPACE_ARTIFACT_TITLE}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button type="button" onClick={onClose}>{UI_TEXT.CLOSE}</button>
      </header>
      {error ? <div role="alert">{error}</div> : null}
      <div className={styles.workspaceMessageMarkdown}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{artifact.content}</ReactMarkdown>
      </div>
      <div className={styles.workspaceArtifactActions}>
        <button type="button" onClick={() => void rename()}>{UI_TEXT.RENAME}</button>
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
