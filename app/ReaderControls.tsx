"use client";

import type { ReaderPageInfo } from "@/lib/readerPageInfo";
import { formatReaderPageLabel } from "@/lib/readerPageInfo";
import { UI_TEXT } from "@/lib/uiText";
import styles from "./page.module.css";

type Props = {
  onBack: () => void;
  onContents: () => void;
  hasToc: boolean;
  onOpenSettings: () => void;
  onAsk: () => void;
  pageInfo: ReaderPageInfo;
  visible?: boolean;
};

export default function ReaderControls({
  onBack,
  onContents,
  hasToc,
  onOpenSettings,
  onAsk,
  pageInfo,
  visible = true,
}: Props) {
  const handleContents = () => {
    if (!hasToc) return;
    onContents();
  };

  return (
    <div
      className={`${styles.readerChrome} ${
        visible ? "" : styles.readerChromeControlsHidden
      }`}
    >
      <button
        className={styles.readerOverlayBack}
        onClick={onBack}
        title={UI_TEXT.LIBRARY}
        aria-label={UI_TEXT.LIBRARY}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          aria-hidden="true"
        >
          <path d="M8 8l12 12M20 8 8 20" strokeLinecap="round" />
        </svg>
      </button>

      <div className={styles.readerPagePill}>
        {formatReaderPageLabel(pageInfo)}
      </div>

      <div className={styles.readerActionMenu}>
        <button
          className={styles.readerMenuRow}
          onClick={handleContents}
          disabled={!hasToc}
        >
          <span>{UI_TEXT.CONTENTS}</span>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M8 6h13M8 12h13M8 18h13" strokeLinecap="round" />
            <circle cx="3.5" cy="6" r="1" fill="currentColor" stroke="none" />
            <circle cx="3.5" cy="12" r="1" fill="currentColor" stroke="none" />
            <circle cx="3.5" cy="18" r="1" fill="currentColor" stroke="none" />
          </svg>
        </button>

        <button className={styles.readerMenuRow} onClick={onAsk}>
          <span>{UI_TEXT.ASK_AI}</span>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m16.5 16.5 4 4" strokeLinecap="round" />
          </svg>
        </button>

        <button className={styles.readerMenuRow} onClick={onOpenSettings}>
          <span>主题与设置</span>
          <span className={styles.readerMenuTrailing}>大小</span>
        </button>
      </div>
    </div>
  );
}
