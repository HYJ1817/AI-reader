"use client";

import { useRef, useState, type CSSProperties } from "react";
import {
  DEFAULT_READER_PREFERENCES,
  readerPreferenceChangeNeedsMotion,
  updateReaderPreferenceDraft,
  type ReaderPreferences,
} from "@/lib/readerPreferences";
import { UI_TEXT } from "@/lib/uiText";
import BottomSheet from "./BottomSheet";
import styles from "./page.module.css";

type Props = {
  preferences: ReaderPreferences;
  onChange: (prefs: ReaderPreferences) => void;
  onClose: () => void;
};

type SliderConfig = {
  key: "lineHeight" | "letterSpacingPercent" | "wordSpacingPercent" | "pageMarginPx";
  label: string;
  icon: "line" | "letter" | "word" | "margin";
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
};

const SLIDERS: SliderConfig[] = [
  {
    key: "lineHeight",
    label: "行间距",
    icon: "line",
    min: 1.3,
    max: 2.2,
    step: 0.05,
    format: (value) => value.toFixed(2),
  },
  {
    key: "letterSpacingPercent",
    label: "字符间距",
    icon: "letter",
    min: 0,
    max: 12,
    step: 1,
    format: (value) => `${Math.round(value)}%`,
  },
  {
    key: "wordSpacingPercent",
    label: "词间距",
    icon: "word",
    min: 0,
    max: 30,
    step: 1,
    format: (value) => `${Math.round(value)}%`,
  },
  {
    key: "pageMarginPx",
    label: "页边空白",
    icon: "margin",
    min: 0,
    max: 40,
    step: 2,
    format: (value) => `${Math.round(value)}px`,
  },
];

const FONT_LABEL: Record<ReaderPreferences["fontFamily"], string> = {
  default: "原书",
  system: "苹方",
  serif: "宋体",
};

const FONT_STYLE: Record<ReaderPreferences["fontFamily"], CSSProperties["fontFamily"]> = {
  default: undefined,
  system:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
  serif: '"Songti SC", "STSong", "Noto Serif CJK SC", serif',
};

export default function ReaderCustomSettingsPanel({
  preferences,
  onChange,
  onClose,
}: Props) {
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

  function cycleFontFamily() {
    const next =
      draft.fontFamily === "default"
        ? "system"
        : draft.fontFamily === "system"
          ? "serif"
          : "default";
    updateImmediately("fontFamily", next);
  }

  function resetCustomSettings() {
    const next: ReaderPreferences = {
      ...draftRef.current,
      fontFamily: DEFAULT_READER_PREFERENCES.fontFamily,
      boldText: DEFAULT_READER_PREFERENCES.boldText,
      lineHeight: DEFAULT_READER_PREFERENCES.lineHeight,
      contentWidth: DEFAULT_READER_PREFERENCES.contentWidth,
      customLayoutEnabled: DEFAULT_READER_PREFERENCES.customLayoutEnabled,
      letterSpacingPercent: DEFAULT_READER_PREFERENCES.letterSpacingPercent,
      wordSpacingPercent: DEFAULT_READER_PREFERENCES.wordSpacingPercent,
      pageMarginPx: DEFAULT_READER_PREFERENCES.pageMarginPx,
      justifyText: DEFAULT_READER_PREFERENCES.justifyText,
    };
    draftRef.current = next;
    committedRef.current = next;
    setDraft(next);
    onChange(next);
  }

  const previewStyle: CSSProperties = {
    fontFamily: FONT_STYLE[draft.fontFamily],
    fontWeight: draft.boldText ? 700 : undefined,
    letterSpacing:
      draft.customLayoutEnabled && draft.letterSpacingPercent > 0
        ? `${draft.letterSpacingPercent / 100}em`
        : undefined,
    lineHeight: draft.customLayoutEnabled
      ? draft.lineHeight
      : DEFAULT_READER_PREFERENCES.lineHeight,
    paddingInline: `${20 + (draft.customLayoutEnabled ? draft.pageMarginPx : 0)}px`,
    textAlign: draft.customLayoutEnabled && draft.justifyText ? "justify" : undefined,
    wordSpacing:
      draft.customLayoutEnabled && draft.wordSpacingPercent > 0
        ? `${draft.wordSpacingPercent / 100}em`
        : undefined,
  };

  return (
    <BottomSheet
      onClose={onClose}
      ariaLabel="自定义设置"
      className={styles.readerCustomSettingsSheet}
      showGrabber={false}
    >
      {(close) => (
        <>
          <div className={styles.readerCustomHeader}>
            <button onClick={() => close()} title={UI_TEXT.CLOSE} aria-label={UI_TEXT.CLOSE}>
              <svg width="25" height="25" viewBox="0 0 25 25" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6.5 6.5l12 12M18.5 6.5l-12 12" strokeLinecap="round" />
              </svg>
            </button>
            <h2>自定义设置</h2>
            <button onClick={() => close()} title={UI_TEXT.DONE} aria-label={UI_TEXT.DONE}>
              <svg width="27" height="27" viewBox="0 0 27 27" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M6.5 14.2l4.7 4.7 9.4-10.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className={styles.readerCustomPreview}>
            <div className={styles.readerCustomPreviewText} style={previewStyle}>
              <strong>大小</strong>
              <p>
                几乎是每天下午放学，我都要站到鲁鲁念书的小学门口，看着我的朋友从里面走出来。
                年幼的鲁鲁已经是一个能够控制自己感情的孩子。
              </p>
            </div>
          </div>

          <div className={styles.readerCustomBody}>
            <section
              className={styles.readerCustomSection}
              aria-label="无障碍与布局选项"
            >
              <h3>文本</h3>
              <div className={styles.readerCustomGroup}>
                <button className={styles.readerCustomRow} onClick={cycleFontFamily}>
                  <span className={styles.readerCustomSizeIcon}>
                    <b>大</b>
                    <small>小</small>
                  </span>
                  <span>字体</span>
                  <strong>{FONT_LABEL[draft.fontFamily]} ›</strong>
                </button>
                <label className={styles.readerCustomRow}>
                  <span className={styles.readerCustomBoldLabel}>B</span>
                  <span>粗体文本</span>
                  <input
                    type="checkbox"
                    checked={draft.boldText}
                    onChange={(event) =>
                      updateImmediately("boldText", event.target.checked)
                    }
                  />
                </label>
              </div>
            </section>

            <section className={styles.readerCustomSection}>
              <div className={`${styles.readerCustomGroup} ${styles.readerCustomControlCard}`}>
                <label className={styles.readerCustomRow}>
                  <span>自定义</span>
                  <input
                    type="checkbox"
                    checked={draft.customLayoutEnabled}
                    onChange={(event) =>
                      updateImmediately(
                        "customLayoutEnabled",
                        event.target.checked
                      )
                    }
                  />
                </label>
                {SLIDERS.map((item) => (
                  <label
                    className={styles.readerCustomSliderRow}
                    data-disabled={draft.customLayoutEnabled ? undefined : "true"}
                    key={item.key}
                  >
                    <span className={styles.readerCustomSliderLabel}>{item.label}</span>
                    <strong className={styles.readerCustomSliderValue}>
                      {item.format(Number(draft[item.key]))}
                    </strong>
                    <div className={styles.readerCustomSliderControl}>
                      <ReaderCustomSliderIcon icon={item.icon} />
                      <input
                        type="range"
                        min={item.min}
                        max={item.max}
                        step={item.step}
                        value={Number(draft[item.key])}
                        disabled={!draft.customLayoutEnabled}
                        onChange={(event) =>
                          preview(item.key, Number(event.target.value))
                        }
                        onPointerUp={commitDraft}
                        onPointerCancel={commitDraft}
                        onKeyUp={commitDraft}
                        onBlur={commitDraft}
                      />
                    </div>
                  </label>
                ))}
              </div>
            </section>

            <div className={styles.readerCustomGroup}>
              <div className={styles.readerCustomRow}>
                <span>列</span>
                <strong>自动设定⌄</strong>
              </div>
              <label className={styles.readerCustomRow}>
                <span>使文本两端对齐</span>
                <input
                  type="checkbox"
                  checked={draft.justifyText}
                  disabled={!draft.customLayoutEnabled}
                  onChange={(event) =>
                    updateImmediately("justifyText", event.target.checked)
                  }
                />
              </label>
            </div>

            <button
              className={styles.readerCustomResetButton}
              onClick={resetCustomSettings}
            >
              还原主题
            </button>
          </div>
        </>
      )}
    </BottomSheet>
  );
}

function ReaderCustomSliderIcon({ icon }: { icon: SliderConfig["icon"] }) {
  const commonProps = {
    className: styles.readerCustomSliderSvg,
    viewBox: "0 0 32 32",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <span className={styles.readerCustomSliderIcon} aria-hidden="true">
      {icon === "line" && (
        <svg {...commonProps}>
          <path d="M9 8h14M9 16h14M9 24h14" />
          <path d="M5 9v14" />
          <path d="m3 11 2-2 2 2M3 21l2 2 2-2" />
        </svg>
      )}
      {icon === "letter" && (
        <svg {...commonProps}>
          <path d="M6 22 10.5 9 15 22" />
          <path d="M8 17h5" />
          <path d="M19 10v12M24 10v12" />
          <path d="M20.5 16h2" />
        </svg>
      )}
      {icon === "word" && (
        <svg {...commonProps}>
          <path d="M7 10h18M7 16h14M7 22h18" />
          <path d="M4 10h.01M4 16h.01M4 22h.01" />
        </svg>
      )}
      {icon === "margin" && (
        <svg {...commonProps}>
          <rect x="7" y="8" width="18" height="16" rx="2" />
          <path d="M11 12h10M11 16h10M11 20h7" />
        </svg>
      )}
    </span>
  );
}
