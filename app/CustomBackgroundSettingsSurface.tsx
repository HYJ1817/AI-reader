"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import type { AppPreferences } from "@/lib/appPreferences";
import { UI_TEXT } from "@/lib/uiText";
import styles from "./page.module.css";

export type CustomBackgroundSettingsSurfaceProps = {
  appPreferences: AppPreferences;
  backgroundInputRef: RefObject<HTMLInputElement | null>;
  customBackgroundPreviewUrl: string | null;
  onPreferencesChange: (next: Partial<AppPreferences>) => void;
  onClearBackground: () => void;
  onBack: () => void;
};

function clampCustomBackgroundPreviewEffect(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

export default function CustomBackgroundSettingsSurface({
  appPreferences,
  backgroundInputRef,
  customBackgroundPreviewUrl,
  onPreferencesChange,
  onClearBackground,
  onBack,
}: CustomBackgroundSettingsSurfaceProps) {
  const [customBackgroundOpacityDraft, setCustomBackgroundOpacityDraft] =
    useState(() =>
      clampCustomBackgroundPreviewEffect(
        appPreferences.customBackgroundOpacity
      )
    );
  const committedOpacityRef = useRef(appPreferences.customBackgroundOpacity);

  useEffect(() => {
    const nextOpacity = clampCustomBackgroundPreviewEffect(
      appPreferences.customBackgroundOpacity
    );
    committedOpacityRef.current = nextOpacity;
    setCustomBackgroundOpacityDraft(nextOpacity);
  }, [appPreferences.customBackgroundOpacity]);

  function commitCustomBackgroundOpacity() {
    const nextOpacity = clampCustomBackgroundPreviewEffect(
      customBackgroundOpacityDraft
    );
    if (Math.abs(nextOpacity - committedOpacityRef.current) < 0.001) return;
    committedOpacityRef.current = nextOpacity;
    onPreferencesChange({ customBackgroundOpacity: nextOpacity });
  }

  const customBackgroundOpacityPercent = Math.round(
    customBackgroundOpacityDraft * 100
  );
  const customBackgroundPreviewStyle = {
    "--custom-background-preview-veil-opacity": customBackgroundOpacityDraft,
  } as CSSProperties;

  return (
    <div className={styles.customBackgroundPushedSurface}>
      <div className={styles.customBackgroundSheetHeader}>
        <button onClick={onBack} aria-label={UI_TEXT.LIBRARY}>
          <span aria-hidden="true">{"\u2039"}</span>
          {UI_TEXT.SETTINGS}
        </button>
        <h2>{UI_TEXT.BACKGROUND_CUSTOM}</h2>
      </div>
      <div className={styles.customBackgroundSheetBody}>
        <div className={styles.customBackgroundSheetCard}>
          <div className={styles.customBackgroundPanel}>
            {customBackgroundPreviewUrl ? (
              <figure
                className={styles.customBackgroundPreview}
                style={customBackgroundPreviewStyle}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className={styles.customBackgroundPreviewImage}
                  src={customBackgroundPreviewUrl}
                  alt={UI_TEXT.BACKGROUND_PREVIEW}
                />
              </figure>
            ) : null}
            <label className={styles.backgroundOpacityControl}>
              <span className={styles.settingsRowText}>
                <strong>{UI_TEXT.BACKGROUND_OPACITY}</strong>
                <small>{customBackgroundOpacityPercent}%</small>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                className={styles.backgroundOpacitySlider}
                value={customBackgroundOpacityDraft}
                onChange={(event) =>
                  setCustomBackgroundOpacityDraft(Number(event.target.value))
                }
                onPointerUp={commitCustomBackgroundOpacity}
                onPointerCancel={commitCustomBackgroundOpacity}
                onKeyUp={commitCustomBackgroundOpacity}
                onBlur={commitCustomBackgroundOpacity}
              />
            </label>
          </div>
          <div className={styles.customBackgroundActions}>
            <button onClick={() => backgroundInputRef.current?.click()}>
              {UI_TEXT.CHANGE_BACKGROUND_IMAGE}
            </button>
            <button
              onClick={() => {
                onClearBackground();
                onBack();
              }}
            >
              {UI_TEXT.REMOVE_BACKGROUND_IMAGE}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
