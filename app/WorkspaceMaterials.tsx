"use client";

import type {
  WorkspaceArtifactRecord,
  WorkspaceMemoryRecord,
} from "@/lib/readingWorkspace";
import { UI_TEXT } from "@/lib/uiText";
import styles from "./page.module.css";

export type WorkspaceMaterialsProps = {
  artifacts: WorkspaceArtifactRecord[];
  memories: WorkspaceMemoryRecord[];
  loading: boolean;
  error: string | null;
  onDeleteArtifact: (id: string) => void;
};

export default function WorkspaceMaterials({
  artifacts,
  memories,
  loading,
  error,
  onDeleteArtifact,
}: WorkspaceMaterialsProps) {
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
      {artifacts.length === 0 && memories.length === 0 ? (
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
                <p>{artifact.content}</p>
              </div>
              <button
                type="button"
                onClick={() => onDeleteArtifact(artifact.id)}
                aria-label={`${UI_TEXT.DELETE} ${artifact.title}`}
              >
                {UI_TEXT.DELETE}
              </button>
            </article>
          ))}
        </section>
      ) : null}

      {memories.length > 0 ? (
        <section className={styles.workspaceMaterialSection}>
          <h3>{UI_TEXT.WORKSPACE_MEMORY}</h3>
          {memories.map((memory) => (
            <article key={memory.id} className={styles.workspaceMaterialRow}>
              <div>
                <strong>
                  {memory.state === "active"
                    ? UI_TEXT.WORKSPACE_MEMORY_ACTIVE
                    : UI_TEXT.WORKSPACE_MEMORY_REVOKED}
                </strong>
                <p>{memory.content}</p>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
