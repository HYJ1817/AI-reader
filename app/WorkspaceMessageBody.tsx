"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { triggerBlobDownload } from "@/lib/browserDownload";
import {
  WORKSPACE_LARGE_PREVIEW_CHARS,
  WORKSPACE_LIVE_TAIL_CHARS,
  type WorkspaceMessageRecord,
} from "@/lib/readingWorkspace";
import { UI_TEXT } from "@/lib/uiText";
import { getWorkspaceMessageRenderMode } from "@/lib/workspaceChat";
import styles from "./page.module.css";

export default function WorkspaceMessageBody({
  message,
}: {
  message: WorkspaceMessageRecord;
}) {
  const [expanded, setExpanded] = useState(false);
  const mode = getWorkspaceMessageRenderMode({
    length: message.content.length,
    streaming: message.state === "streaming",
  });

  const exportMessage = () => {
    const blob = new Blob([message.content], {
      type: "text/markdown;charset=utf-8",
    });
    triggerBlobDownload(blob, `workspace-message-${message.id}.md`);
  };

  let content;
  if (mode === "live") {
    content = <div className={styles.workspaceMessageLive}>{message.content}</div>;
  } else if (mode === "live-tail") {
    content = (
      <>
        <div className={styles.workspaceMessageNotice} role="status">
          {UI_TEXT.WORKSPACE_LIVE_TAIL_NOTICE}
        </div>
        <div className={styles.workspaceMessageLive}>
          {message.content.slice(-WORKSPACE_LIVE_TAIL_CHARS)}
        </div>
      </>
    );
  } else if (mode === "collapsed" && !expanded) {
    content = (
      <>
        <div className={styles.workspaceMessageNotice}>
          {UI_TEXT.WORKSPACE_LARGE_MESSAGE_NOTICE}
        </div>
        <div className={styles.workspaceMessageLive}>
          {message.content.slice(0, WORKSPACE_LARGE_PREVIEW_CHARS)}
        </div>
        <button
          type="button"
          className={styles.workspaceMessageAction}
          onClick={() => setExpanded(true)}
        >
          {UI_TEXT.EXPAND}
        </button>
      </>
    );
  } else {
    content = (
      <div className={styles.workspaceMessageMarkdown}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className={styles.workspaceMessageBody}>
      {content}
      {message.content ? (
        <button
          type="button"
          className={styles.workspaceMessageAction}
          onClick={exportMessage}
        >
          {UI_TEXT.EXPORT}
        </button>
      ) : null}
    </div>
  );
}
