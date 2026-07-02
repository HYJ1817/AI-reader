"use client";

import { useRef, useState } from "react";
import type { ReaderMode } from "@/lib/readerMode";
import {
  updateReaderPreferenceDraft,
  type ReaderPreferences,
  type ReaderTheme,
} from "@/lib/readerPreferences";
import { UI_TEXT } from "@/lib/uiText";
import BottomSheet from "./BottomSheet";
import ReaderCustomSettingsPanel from "./ReaderCustomSettingsPanel";
import styles from "./page.module.css";

type Props = {
  preferences: ReaderPreferences;
  mode: ReaderMode;
  onChange: (prefs: ReaderPreferences) => void;
  onModeChange: (mode: ReaderMode) => void;
  onClose: () => void;
};

const THEMES: { value: Extract<ReaderTheme, "light" | "dark">; label: string }[] = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
];

const FONT_STEP = 2;

export default function ReaderSettingsPanel({
  preferences,
  mode,
  onChange,
  onModeChange,
  onClose,
}: Props) {
  const [draft, setDraft] = useState(preferences);
  const [customSettingsOpen, setCustomSettingsOpen] = useState(false);
  const draftRef = useRef(preferences);

  function updateImmediately<K extends keyof ReaderPreferences>(
    key: K,
    value: ReaderPreferences[K]
  ) {
    const next = updateReaderPreferenceDraft(draftRef.current, key, value);
    draftRef.current = next;
    setDraft(next);
    onChange(next);
  }

  function nudgeFontSize(delta: number) {
    const next = Math.min(28, Math.max(14, draftRef.current.fontSizePx + delta));
    updateImmediately("fontSizePx", next);
  }

  return (
    <>
      <BottomSheet
        onClose={onClose}
        ariaLabel="主题与设置"
        className={styles.readerSettingsSheet}
      >
        {(close) => (
          <>
            <div className={styles.readerSettingsHeader}>
              <h2>主题与设置</h2>
              <button onClick={() => close()} title={UI_TEXT.CLOSE} aria-label={UI_TEXT.CLOSE}>
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 7l12 12M19 7 7 19" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className={styles.readerSettingsBody}>
              <div className={styles.readerSettingsControlRow}>
                <div className={styles.readerFontStepper} aria-label="字号">
                  <button onClick={() => nudgeFontSize(-FONT_STEP)}>小</button>
                  <span aria-hidden="true" />
                  <button onClick={() => nudgeFontSize(FONT_STEP)}>大</button>
                </div>
                <div className={styles.readerModeSegment}>
                  <button
                    className={mode === "scroll" ? styles.readerModeSegmentActive : ""}
                    onClick={() => onModeChange("scroll")}
                    aria-pressed={mode === "scroll"}
                    title={UI_TEXT.SCROLL_MODE}
                  >
                    滚
                  </button>
                  <button
                    className={mode === "paged" ? styles.readerModeSegmentActive : ""}
                    onClick={() => onModeChange("paged")}
                    aria-pressed={mode === "paged"}
                    title={UI_TEXT.PAGED_MODE}
                  >
                    页
                  </button>
                </div>
              </div>

              <div className={styles.readerBrightnessRow} aria-hidden="true">
                <span>☀</span>
                <div>
                  <i />
                </div>
                <span>☀</span>
              </div>

              <div className={styles.readerThemePreviewGrid}>
                {THEMES.map((theme) => (
                  <button
                    key={theme.value}
                    className={`${styles.readerThemePreview} ${
                      draft.theme === theme.value
                        ? styles.readerThemePreviewActive
                        : ""
                    }`}
                    data-preview-theme={theme.value}
                    onClick={() => updateImmediately("theme", theme.value)}
                  >
                    <span className={styles.readerThemePreviewSample}>大小</span>
                    <span>{theme.label}</span>
                  </button>
                ))}
              </div>

              <button
                className={styles.readerCustomEntryButton}
                onClick={() => setCustomSettingsOpen(true)}
              >
                <span aria-hidden="true">☼</span>
                自定义
              </button>
            </div>
          </>
        )}
      </BottomSheet>
      {customSettingsOpen && (
        <ReaderCustomSettingsPanel
          preferences={draft}
          onChange={(next) => {
            draftRef.current = next;
            setDraft(next);
            onChange(next);
          }}
          onClose={() => setCustomSettingsOpen(false)}
        />
      )}
    </>
  );
}
