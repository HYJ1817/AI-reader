"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { ReaderMode } from "@/lib/readerMode";
import styles from "./page.module.css";
import { UI_TEXT } from "@/lib/uiText";

type Props = {
  onBack: () => void;
  onContents: () => void;
  hasToc: boolean;
  onOpenSettings: () => void;
  onAsk: () => void;
  readerMode: ReaderMode;
  onReaderModeChange: (mode: ReaderMode) => void;
  visible?: boolean;
};

type ToolStyle = CSSProperties & {
  "--tool-order": number;
};

function toolStyle(order: number): ToolStyle {
  return { "--tool-order": order };
}

export default function ReaderControls({
  onBack,
  onContents,
  hasToc,
  onOpenSettings,
  onAsk,
  readerMode,
  onReaderModeChange,
  visible = true,
}: Props) {
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const toolsVisible = visible;

  useEffect(() => {
    if (visible) return;
    const frame = window.requestAnimationFrame(() => {
      setModeMenuOpen(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [visible]);

  const closeMenu = () => {
    setModeMenuOpen(false);
  };

  const handleContents = () => {
    if (!hasToc) return;
    closeMenu();
    onContents();
  };

  const handleReaderModeChange = (mode: ReaderMode) => {
    onReaderModeChange(mode);
    closeMenu();
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
          strokeWidth="2.4"
          aria-hidden="true"
        >
          <path d="M17 6l-8 8 8 8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div
        className={`${styles.readerFloatingTools} ${
          toolsVisible ? styles.readerFloatingToolsOpen : ""
        }`}
      >
        <button
          className={styles.readerFloatingTool}
          style={toolStyle(0)}
          onClick={handleContents}
          disabled={!hasToc}
          title={UI_TEXT.CONTENTS}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M8 6h13M8 12h13M8 18h13" strokeLinecap="round" />
            <circle cx="3.5" cy="6" r="1" fill="currentColor" stroke="none" />
            <circle cx="3.5" cy="12" r="1" fill="currentColor" stroke="none" />
            <circle cx="3.5" cy="18" r="1" fill="currentColor" stroke="none" />
          </svg>
          <span>{UI_TEXT.CONTENTS}</span>
        </button>

        <button
          className={styles.readerFloatingTool}
          style={toolStyle(1)}
          onClick={() => {
            closeMenu();
            onOpenSettings();
          }}
          title={UI_TEXT.READER_APPEARANCE}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 19h6M7 5v14M14 8h6M17 8v11" strokeLinecap="round" />
            <circle cx="7" cy="8" r="2" fill="var(--surface-primary)" />
            <circle cx="17" cy="16" r="2" fill="var(--surface-primary)" />
          </svg>
          <span>{UI_TEXT.READER_APPEARANCE}</span>
        </button>

        <button
          className={`${styles.readerFloatingTool} ${
            modeMenuOpen ? styles.readerFloatingToolActive : ""
          }`}
          style={toolStyle(2)}
          onClick={() => setModeMenuOpen((open) => !open)}
          title={UI_TEXT.READING_MODE}
          aria-expanded={modeMenuOpen}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M12 4v16" />
          </svg>
          <span>{UI_TEXT.READING_MODE}</span>
        </button>

        <button
          className={styles.readerFloatingTool}
          style={toolStyle(3)}
          onClick={() => {
            closeMenu();
            onAsk();
          }}
          title={UI_TEXT.ASK_AI}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 3a7 7 0 0 0-4 12.7V21l4-2 4 2v-5.3A7 7 0 0 0 12 3z" strokeLinejoin="round" />
            <path d="M9 10h6M9 13h4" strokeLinecap="round" />
          </svg>
          <span>{UI_TEXT.ASK_AI}</span>
        </button>

      </div>

      <div
        className={`${styles.readerModeMenu} ${
          toolsVisible && modeMenuOpen ? styles.readerModeMenuOpen : ""
        }`}
      >
        <button
          className={readerMode === "scroll" ? styles.readerModeOptionActive : ""}
          onClick={() => handleReaderModeChange("scroll")}
          aria-pressed={readerMode === "scroll"}
        >
          {UI_TEXT.SCROLL_MODE}
        </button>
        <button
          className={readerMode === "paged" ? styles.readerModeOptionActive : ""}
          onClick={() => handleReaderModeChange("paged")}
          aria-pressed={readerMode === "paged"}
        >
          {UI_TEXT.PAGED_MODE}
        </button>
      </div>

    </div>
  );
}
