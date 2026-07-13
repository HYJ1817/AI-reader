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
import styles from "./page.module.css";

type Props = {
  preferences: ReaderPreferences;
  mode: ReaderMode;
  onChange: (prefs: ReaderPreferences) => void;
  onModeChange: (mode: ReaderMode) => void;
  onOpenCustomSettings: () => void;
  onClose: () => void;
};

type ReaderSettingsMenu = "mode" | "theme";

const THEMES: { value: Extract<ReaderTheme, "light" | "dark">; label: string }[] = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
];

const READER_MODE_MENU_OPTIONS: { value: ReaderMode; label: string }[] = [
  { value: "scroll", label: UI_TEXT.SCROLL_MODE },
  { value: "paged", label: UI_TEXT.PAGED_MODE },
];

const READER_THEME_MENU_OPTIONS: { value: ReaderTheme; label: string }[] = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "匹配设备" },
  { value: "sepia", label: "匹配周边环境" },
];

const FONT_MIN = 14;
const FONT_MAX = 28;
const FONT_STEP = 2;
const FONT_SCALE_DOTS = Math.round((FONT_MAX - FONT_MIN) / FONT_STEP) + 1;

export default function ReaderSettingsPanel({
  preferences,
  mode,
  onChange,
  onModeChange,
  onOpenCustomSettings,
  onClose,
}: Props) {
  const [draft, setDraft] = useState(preferences);
  const [openMenu, setOpenMenu] = useState<ReaderSettingsMenu | null>(null);
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
    const next = Math.min(
      FONT_MAX,
      Math.max(FONT_MIN, draftRef.current.fontSizePx + delta)
    );
    updateImmediately("fontSizePx", next);
  }

  const fontScaleActiveIndex = Math.min(
    FONT_SCALE_DOTS - 1,
    Math.max(0, Math.round((draft.fontSizePx - FONT_MIN) / FONT_STEP))
  );

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
                  <button
                    type="button"
                    aria-label="减小字号"
                    onClick={() => nudgeFontSize(-FONT_STEP)}
                  >
                    小
                  </button>
                  <span aria-hidden="true" />
                  <button
                    type="button"
                    aria-label="增大字号"
                    onClick={() => nudgeFontSize(FONT_STEP)}
                  >
                    大
                  </button>
                </div>
                <div className={styles.readerModeSegment}>
                  <button
                    type="button"
                    className={openMenu === "mode" ? styles.readerModeSegmentActive : ""}
                    onClick={() => setOpenMenu(openMenu === "mode" ? null : "mode")}
                    aria-pressed={openMenu === "mode"}
                    aria-label="阅读方式"
                    title="阅读方式"
                  >
                    <span className={styles.readerModeIcon} aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="6" y="3" width="11" height="18" rx="2" />
                        <path d="M9 8h5M9 12h5M9 16h4M19 7v10" strokeLinecap="round" />
                      </svg>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={openMenu === "theme" ? styles.readerModeSegmentActive : ""}
                    onClick={() => setOpenMenu(openMenu === "theme" ? null : "theme")}
                    aria-pressed={openMenu === "theme"}
                    aria-label="主题模式"
                    title="主题模式"
                  >
                    <span className={styles.readerThemeIcon} aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3a9 9 0 1 0 0 18V3Z" opacity="0.35" />
                        <path d="M12 3a9 9 0 0 1 0 18V3Z" />
                      </svg>
                    </span>
                  </button>
                </div>
              </div>

              {openMenu === "mode" && (
                <div className={styles.readerSettingsPopover} data-menu="mode">
                  {READER_MODE_MENU_OPTIONS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={styles.readerSettingsPopoverRow}
                      onClick={() => {
                        onModeChange(item.value);
                        setOpenMenu(null);
                      }}
                    >
                      <span className={styles.readerSettingsPopoverCheck}>
                        {mode === item.value ? "✓" : ""}
                      </span>
                      <span className={styles.readerSettingsPopoverIcon} aria-hidden="true">
                        {item.value === "scroll" ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="6" y="3" width="11" height="18" rx="2" />
                            <path d="M9 8h5M9 12h5M9 16h4M19 7v10" strokeLinecap="round" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M7 4h7a3 3 0 0 1 3 3v13H9a3 3 0 0 1-3-3V5a1 1 0 0 1 1-1Z" />
                            <path d="M17 7h1a2 2 0 0 1 2 2v10" strokeLinecap="round" />
                          </svg>
                        )}
                      </span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {openMenu === "theme" && (
                <div className={styles.readerSettingsPopover} data-menu="theme">
                  {READER_THEME_MENU_OPTIONS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={styles.readerSettingsPopoverRow}
                      onClick={() => {
                        updateImmediately("theme", item.value);
                        setOpenMenu(null);
                      }}
                    >
                      <span className={styles.readerSettingsPopoverCheck}>
                        {draft.theme === item.value ? "✓" : ""}
                      </span>
                      <span className={styles.readerSettingsPopoverIcon} aria-hidden="true">
                        {item.value === "light" && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.6 6.6 8 8M16 16l1.4 1.4M17.4 6.6 16 8M8 16l-1.4 1.4" strokeLinecap="round" />
                            <path d="M8 14h8" strokeLinecap="round" />
                          </svg>
                        )}
                        {item.value === "dark" && (
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M15.8 3.3A8.6 8.6 0 1 0 20.7 14 6.8 6.8 0 0 1 15.8 3.3Z" />
                            <path d="M18.5 5.4h2M19.5 4.4v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                          </svg>
                        )}
                        {item.value === "system" && (
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 3a9 9 0 1 0 0 18V3Z" opacity="0.35" />
                            <path d="M12 3a9 9 0 0 1 0 18V3Z" />
                          </svg>
                        )}
                        {item.value === "sepia" && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="4" />
                            <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" strokeLinecap="round" />
                          </svg>
                        )}
                      </span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className={styles.readerFontScale} aria-hidden="true">
                {Array.from({ length: FONT_SCALE_DOTS }, (_, index) => (
                  <span
                    key={index}
                    className={styles.readerFontScaleDot}
                    data-active={index <= fontScaleActiveIndex ? "true" : undefined}
                  />
                ))}
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
                onClick={onOpenCustomSettings}
              >
                <span className={styles.readerCustomGearIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path
                      d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.2a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4A2 2 0 0 0 4 9.9l.2.1a2 2 0 0 1 1 1.7v.6a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.8l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.2a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.2a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.8l-.2-.1a2 2 0 0 1-1-1.7v-.6a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.8l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.2a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </span>
                自定义
              </button>
            </div>
          </>
        )}
      </BottomSheet>
    </>
  );
}
