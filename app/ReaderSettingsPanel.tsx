"use client";

import { useRef, useState } from "react";
import {
  readerPreferenceChangeNeedsMotion,
  updateReaderPreferenceDraft,
  type ReaderPreferences,
  type ReaderTheme,
} from "@/lib/readerPreferences";
import BottomSheet from "./BottomSheet";
import styles from "./page.module.css";

type Props = {
  preferences: ReaderPreferences;
  onChange: (prefs: ReaderPreferences) => void;
  onClose: () => void;
};

const THEMES: { value: ReaderTheme; label: string }[] = [
  { value: "system", label: "跟随系统" },
  { value: "light", label: "浅色" },
  { value: "sepia", label: "米色" },
  { value: "dark", label: "深色" },
];

export default function ReaderSettingsPanel({ preferences, onChange, onClose }: Props) {
  const [draft, setDraft] = useState(preferences);
  const draftRef = useRef(preferences);
  const committedRef = useRef(preferences);

  function preview<K extends keyof ReaderPreferences>(
    key: K,
    value: ReaderPreferences[K]
  ) {
    const next = updateReaderPreferenceDraft(draftRef.current, key, value);
    draftRef.current = next;
    setDraft(next);
  }

  function commitDraft() {
    const next = draftRef.current;
    if (!readerPreferenceChangeNeedsMotion(committedRef.current, next)) return;
    committedRef.current = next;
    onChange(next);
  }

  function updateImmediately<K extends keyof ReaderPreferences>(
    key: K,
    value: ReaderPreferences[K]
  ) {
    const next = updateReaderPreferenceDraft(draftRef.current, key, value);
    draftRef.current = next;
    committedRef.current = next;
    setDraft(next);
    onChange(next);
  }

  return (
    <BottomSheet onClose={onClose} ariaLabel="主题与设置">
      {(close) => (
        <>
        <div className={styles.sheetHeader}>
          <h2 className={styles.sheetTitle}>主题与设置</h2>
          <button className={styles.iconButton} onClick={() => close()} title="关闭" aria-label="关闭">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className={styles.sheetBody}>
          <div className={styles.readerSettingsBody}>
            <div className={styles.readerSettingsGroup}>
              <p className={styles.readerSettingsGroupTitle}>外观</p>
              <div className={styles.readerSettingsList}>
                <div className={styles.readerThemeRow}>
                  <span className={styles.readerThemeLabel}>主题</span>
                  <div className={styles.readerThemeSegment}>
                    {THEMES.map((t) => (
                      <button
                        key={t.value}
                        className={draft.theme === t.value ? styles.readerThemeSegmentActive : ""}
                        onClick={() => updateImmediately("theme", t.value)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.readerSettingsGroup}>
              <p className={styles.readerSettingsGroupTitle}>排版</p>
              <div className={styles.readerSettingsList}>
                <div className={styles.readerSettingSliderRow}>
                  <div className={styles.readerSettingSliderHeader}>
                    <span className={styles.readerSettingLabel}>字号</span>
                    <span className={styles.readerSettingValue}>{draft.fontSizePx}px</span>
                  </div>
                  <input
                    type="range"
                    min={14}
                    max={28}
                    step={1}
                    value={draft.fontSizePx}
                    onChange={(e) => preview("fontSizePx", Number(e.target.value))}
                    onPointerUp={commitDraft}
                    onPointerCancel={commitDraft}
                    onKeyUp={commitDraft}
                    onBlur={commitDraft}
                    className={styles.readerSettingSliderInput}
                  />
                </div>

                <div className={styles.readerSettingSliderRow}>
                  <div className={styles.readerSettingSliderHeader}>
                    <span className={styles.readerSettingLabel}>行高</span>
                    <span className={styles.readerSettingValue}>{draft.lineHeight.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={1.3}
                    max={2.2}
                    step={0.05}
                    value={draft.lineHeight}
                    onChange={(e) => preview("lineHeight", Number(e.target.value))}
                    onPointerUp={commitDraft}
                    onPointerCancel={commitDraft}
                    onKeyUp={commitDraft}
                    onBlur={commitDraft}
                    className={styles.readerSettingSliderInput}
                  />
                </div>

                <div className={styles.readerSettingSliderRow}>
                  <div className={styles.readerSettingSliderHeader}>
                    <span className={styles.readerSettingLabel}>内容宽度</span>
                    <span className={styles.readerSettingValue}>{draft.contentWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min={320}
                    max={960}
                    step={20}
                    value={draft.contentWidth}
                    onChange={(e) => preview("contentWidth", Number(e.target.value))}
                    onPointerUp={commitDraft}
                    onPointerCancel={commitDraft}
                    onKeyUp={commitDraft}
                    onBlur={commitDraft}
                    className={styles.readerSettingSliderInput}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.readerSettingsDone}>
            <button
              onClick={() => {
                commitDraft();
                close();
              }}
            >
              完成
            </button>
          </div>
        </div>
        </>
      )}
    </BottomSheet>
  );
}
