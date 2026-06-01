"use client";

import type { ReaderPreferences, ReaderTheme } from "@/lib/readerPreferences";
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
  function update<K extends keyof ReaderPreferences>(key: K, value: ReaderPreferences[K]) {
    onChange({ ...preferences, [key]: value });
  }

  return (
    <div className={styles.sheetOverlay} onClick={onClose}>
      <div className={styles.bottomSheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetGrabber} />
        <div className={styles.sheetHeader}>
          <h2 className={styles.sheetTitle}>主题与设置</h2>
          <button className={styles.iconButton} onClick={onClose} title="关闭" aria-label="关闭">
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
                        className={preferences.theme === t.value ? styles.readerThemeSegmentActive : ""}
                        onClick={() => update("theme", t.value)}
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
                    <span className={styles.readerSettingValue}>{preferences.fontSizePx}px</span>
                  </div>
                  <input
                    type="range"
                    min={14}
                    max={28}
                    step={1}
                    value={preferences.fontSizePx}
                    onChange={(e) => update("fontSizePx", Number(e.target.value))}
                    className={styles.readerSettingSliderInput}
                  />
                </div>

                <div className={styles.readerSettingSliderRow}>
                  <div className={styles.readerSettingSliderHeader}>
                    <span className={styles.readerSettingLabel}>行高</span>
                    <span className={styles.readerSettingValue}>{preferences.lineHeight.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={1.3}
                    max={2.2}
                    step={0.05}
                    value={preferences.lineHeight}
                    onChange={(e) => update("lineHeight", Number(e.target.value))}
                    className={styles.readerSettingSliderInput}
                  />
                </div>

                <div className={styles.readerSettingSliderRow}>
                  <div className={styles.readerSettingSliderHeader}>
                    <span className={styles.readerSettingLabel}>内容宽度</span>
                    <span className={styles.readerSettingValue}>{preferences.contentWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min={320}
                    max={960}
                    step={20}
                    value={preferences.contentWidth}
                    onChange={(e) => update("contentWidth", Number(e.target.value))}
                    className={styles.readerSettingSliderInput}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.readerSettingsDone}>
            <button onClick={onClose}>完成</button>
          </div>
        </div>
      </div>
    </div>
  );
}
