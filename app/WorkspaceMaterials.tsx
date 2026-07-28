"use client";

import { useState } from "react";
import type { AnnotationRecord } from "@/lib/db";
import type {
  WorkspaceArtifactRecord,
  WorkspaceMemoryRecord,
} from "@/lib/readingWorkspace";
import { UI_TEXT } from "@/lib/uiText";
import WorkspaceArtifactPreview from "./WorkspaceArtifactPreview";
import styles from "./page.module.css";

export type WorkspaceMaterialsProps = {
  artifacts: WorkspaceArtifactRecord[];
  memories: WorkspaceMemoryRecord[];
  annotations: AnnotationRecord[];
  loading: boolean;
  error: string | null;
  onDeleteArtifact: (id: string) => void;
  onRenameArtifact: (id: string, title: string) => Promise<void> | void;
  onRevokeMemory: (id: string) => Promise<void> | void;
  onDeleteRevokedMemory: (id: string) => Promise<void> | void;
};

export default function WorkspaceMaterials({
  artifacts,
  memories,
  annotations,
  loading,
  error,
  onDeleteArtifact,
  onRenameArtifact,
  onRevokeMemory,
  onDeleteRevokedMemory,
}: WorkspaceMaterialsProps) {
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const selectedArtifact = artifacts.find((item) => item.id === selectedArtifactId);
  const activeMemories = memories.filter((memory) => memory.state === "active");
  const revokedMemories = memories.filter((memory) => memory.state === "revoked");
  if (loading) {
    return <div className={styles.workspaceStatus}>{UI_TEXT.LOADING}</div>;
  }
  if (error) {
    return (
      <div className={styles.workspaceStatus} role="alert">
        {error}
      </div>
    );
  }

  return (
    <div className={styles.workspaceMaterials}>
      {selectedArtifact ? (
        <WorkspaceArtifactPreview
          artifact={selectedArtifact}
          onClose={() => setSelectedArtifactId(null)}
          onRename={onRenameArtifact}
          onDelete={onDeleteArtifact}
        />
      ) : null}

      {artifacts.length === 0 && memories.length === 0 && annotations.length === 0 ? (
        <div className={styles.workspaceEmptyState}>
          <strong>{UI_TEXT.WORKSPACE_MATERIALS_EMPTY_TITLE}</strong>
          <span>{UI_TEXT.WORKSPACE_MATERIALS_EMPTY_HINT}</span>
        </div>
      ) : null}

      {artifacts.length > 0 ? (
        <section className={styles.workspaceMaterialSection}>
          <h3>{UI_TEXT.WORKSPACE_ARTIFACTS}</h3>
          {artifacts.map((artifact) => (
            <article key={artifact.id} className={styles.workspaceMaterialRow}>
              <div>
                <strong>{artifact.title}</strong>
                <span>{artifact.kind} · {new Date(artifact.updatedAt).toLocaleDateString()}</span>
                <p>{artifact.content.slice(0, 180)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedArtifactId(artifact.id)}
                aria-label={`${UI_TEXT.OPEN} ${artifact.title}`}
              >
                {UI_TEXT.OPEN}
              </button>
            </article>
          ))}
        </section>
      ) : null}

      {annotations.length > 0 ? (
        <section className={styles.workspaceMaterialSection}>
          <h3>{UI_TEXT.WORKSPACE_ANNOTATIONS}</h3>
          {annotations.map((annotation) => (
            <article key={annotation.id} className={styles.workspaceMaterialRow}>
              <div>
                <strong>{annotation.kind === "bookmark" ? UI_TEXT.BOOKMARK : UI_TEXT.HIGHLIGHT}</strong>
                {annotation.text ? <p>{annotation.text}</p> : null}
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {memories.length > 0 ? (
        <section className={styles.workspaceMaterialSection}>
          <h3>{UI_TEXT.WORKSPACE_MEMORY}</h3>
          {activeMemories.map((memory) => (
            <article key={memory.id} className={styles.workspaceMaterialRow}>
              <div>
                <strong>{UI_TEXT.WORKSPACE_MEMORY_ACTIVE}</strong>
                <p>{memory.content}</p>
              </div>
              <button type="button" onClick={() => void onRevokeMemory(memory.id)}>
                {UI_TEXT.REVOKE}
              </button>
            </article>
          ))}
          {revokedMemories.length > 0 ? (
            <details className={styles.workspaceRevokedMemories}>
              <summary>{UI_TEXT.WORKSPACE_REVOKED_HISTORY}</summary>
              {revokedMemories.map((memory) => (
                <article key={memory.id} className={styles.workspaceMaterialRow}>
                  <div>
                    <strong>{UI_TEXT.WORKSPACE_MEMORY_REVOKED}</strong>
                    <p>{memory.content}</p>
                  </div>
                  <button
                    type="button"
                    className={styles.workspaceDestructiveAction}
                    onClick={() => {
                      if (!window.confirm(UI_TEXT.WORKSPACE_DELETE_MEMORY_CONFIRM)) return;
                      void onDeleteRevokedMemory(memory.id);
                    }}
                  >
                    {UI_TEXT.DELETE}
                  </button>
                </article>
              ))}
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
