"use client";

import type {
  CSSProperties,
  RefObject,
} from "react";
import type { AppPreferences } from "@/lib/appPreferences";
import { UI_TEXT } from "@/lib/uiText";
import BottomSheet from "./BottomSheet";
import styles from "./page.module.css";

type Props = {
  appPreferences: AppPreferences;
  backgroundInputRef: RefObject<HTMLInputElement | null>;
  customBackgroundPreviewUrl: string | null;
  onPreferencesChange: (next: Partial<AppPreferences>) => void;
  onClearBackground: () => void;
  onClose: () => void;
};

function clampCustomBackgroundPreviewEffect(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

export default function CustomBackgroundSettingsSheet({
  appPreferences,
  backgroundInputRef,
  customBackgroundPreviewUrl,
  onPreferencesChange,
  onClearBackground,
  onClose,
}: Props) {
  const customBackgroundOpacityPercent = Math.round(
    appPreferences.customBackgroundOpacity * 100
  );
  const customBackgroundPreviewEffect =
    clampCustomBackgroundPreviewEffect(appPreferences.customBackgroundOpacity);
  const customBackgroundPreviewStyle = {
    "--custom-background-preview-blur": `${Math.round(
      customBackgroundPreviewEffect * 42
    )}px`,
    "--custom-background-preview-veil-opacity": customBackgroundPreviewEffect,
  } as CSSProperties;

  return (
    <BottomSheet
      onClose={onClose}
      ariaLabel={UI_TEXT.BACKGROUND_CUSTOM}
      className={styles.customBackgroundSettingsSheet}
    >
      {(close) => (
        <>
          <div className={styles.customBackgroundSheetHeader}>
            <h2>{UI_TEXT.BACKGROUND_CUSTOM}</h2>
            <button onClick={() => close()} aria-label={UI_TEXT.CLOSE}>
              {UI_TEXT.CLOSE}
            </button>
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
                    value={appPreferences.customBackgroundOpacity}
                    onChange={(event) =>
                      onPreferencesChange({
                        customBackgroundOpacity: Number(event.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <div className={styles.customBackgroundActions}>
                <button onClick={() => backgroundInputRef.current?.click()}>
                  {UI_TEXT.CHANGE_BACKGROUND_IMAGE}
                </button>
                <button onClick={() => close(onClearBackground)}>
                  {UI_TEXT.REMOVE_BACKGROUND_IMAGE}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </BottomSheet>
  );
}
