"use client";

import { AnimatePresence, m } from "motion/react";
import { useState } from "react";
import type { AnnotationRecord } from "@/lib/db";
import { getRoleTransition } from "@/lib/motionSystem";
import type {
  WorkspaceArtifactRecord,
  WorkspaceMemoryRecord,
} from "@/lib/readingWorkspace";
import { UI_TEXT } from "@/lib/uiText";
import { useAppReducedMotion } from "./AppMotionRoot";
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
  const reduceMotion = useAppReducedMotion();
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const selectedArtifact = artifacts.find((item) => item.id === selectedArtifactId);
  const activeMemories = memories.filter((memory) => memory.state === "active");
  const revokedMemories = memories.filter((memory) => memory.state === "revoked");
  if (loading || error) {
    return (
      <div className={styles.workspaceMaterialsStatusHost}>
        <AnimatePresence initial={false} mode="sync">
          <m.div
            key={error ? "error" : "loading"}
            className={`${styles.workspaceStatus} ${styles.workspaceStatusRegion}`}
            data-motion-role="inline-status"
            role={error ? "alert" : "status"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{
              opacity: 0,
              transition: getRoleTransition("state-exit", reduceMotion),
            }}
            transition={getRoleTransition("state-enter", reduceMotion)}
          >
            {error || UI_TEXT.LOADING}
          </m.div>
        </AnimatePresence>
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

      <AnimatePresence initial={false} mode="sync">
        {artifacts.length === 0 && memories.length === 0 && annotations.length === 0 ? (
          <m.div
            key="materials-empty"
            className={styles.workspaceEmptyState}
            data-materials-empty-state="true"
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
            <strong>{UI_TEXT.WORKSPACE_MATERIALS_EMPTY_TITLE}</strong>
            <span>{UI_TEXT.WORKSPACE_MATERIALS_EMPTY_HINT}</span>
          </m.div>
        ) : null}
      </AnimatePresence>

      {artifacts.length > 0 ? (
        <section className={styles.workspaceMaterialSection}>
          <h3>{UI_TEXT.WORKSPACE_ARTIFACTS}</h3>
          <AnimatePresence initial={false} mode="popLayout">
          {artifacts.map((artifact) => (
            <m.article
              layout={reduceMotion ? false : "position"}
              key={artifact.id}
              className={styles.workspaceMaterialRow}
              data-workspace-material-id={artifact.id}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={{
                opacity: 0,
                y: reduceMotion ? 0 : 6,
                transition: getRoleTransition("state-exit", reduceMotion),
              }}
              transition={getRoleTransition("state-enter", reduceMotion)}
            >
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
            </m.article>
          ))}
          </AnimatePresence>
        </section>
      ) : null}

      {annotations.length > 0 ? (
        <section className={styles.workspaceMaterialSection}>
          <h3>{UI_TEXT.WORKSPACE_ANNOTATIONS}</h3>
          <AnimatePresence initial={false} mode="popLayout">
          {annotations.map((annotation) => (
            <m.article
              layout={reduceMotion ? false : "position"}
              key={annotation.id}
              className={styles.workspaceMaterialRow}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={{
                opacity: 0,
                y: reduceMotion ? 0 : 6,
                transition: getRoleTransition("state-exit", reduceMotion),
              }}
              transition={getRoleTransition("state-enter", reduceMotion)}
            >
              <div>
                <strong>{annotation.kind === "bookmark" ? UI_TEXT.BOOKMARK : UI_TEXT.HIGHLIGHT}</strong>
                {annotation.text ? <p>{annotation.text}</p> : null}
              </div>
            </m.article>
          ))}
          </AnimatePresence>
        </section>
      ) : null}

      {memories.length > 0 ? (
        <section className={styles.workspaceMaterialSection}>
          <h3>{UI_TEXT.WORKSPACE_MEMORY}</h3>
          <AnimatePresence initial={false} mode="popLayout">
          {activeMemories.map((memory) => (
            <m.article
              layout={reduceMotion ? false : "position"}
              key={memory.id}
              className={styles.workspaceMaterialRow}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={{
                opacity: 0,
                y: reduceMotion ? 0 : 6,
                transition: getRoleTransition("state-exit", reduceMotion),
              }}
              transition={getRoleTransition("state-enter", reduceMotion)}
            >
              <div>
                <strong>{UI_TEXT.WORKSPACE_MEMORY_ACTIVE}</strong>
                <p>{memory.content}</p>
              </div>
              <button type="button" onClick={() => void onRevokeMemory(memory.id)}>
                {UI_TEXT.REVOKE}
              </button>
            </m.article>
          ))}
          </AnimatePresence>
          {revokedMemories.length > 0 ? (
            <details className={styles.workspaceRevokedMemories}>
              <summary>{UI_TEXT.WORKSPACE_REVOKED_HISTORY}</summary>
              <AnimatePresence initial={false} mode="popLayout">
              {revokedMemories.map((memory) => (
                <m.article
                  layout={reduceMotion ? false : "position"}
                  key={memory.id}
                  className={styles.workspaceMaterialRow}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  exit={{
                    opacity: 0,
                    y: reduceMotion ? 0 : 6,
                    transition: getRoleTransition("state-exit", reduceMotion),
                  }}
                  transition={getRoleTransition("state-enter", reduceMotion)}
                >
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
                </m.article>
              ))}
              </AnimatePresence>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
