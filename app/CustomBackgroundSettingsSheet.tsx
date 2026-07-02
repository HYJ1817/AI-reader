"use client";

import type {
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

  return (
    <BottomSheet
      onClose={onClose}
      ariaLabel={UI_TEXT.BACKGROUND_CUSTOM}
      className={styles.customBackgroundSettingsSheet}
    >
      {(close) => (
        <>
          <div className={styles.sheetHeader}>
            <h2 className={styles.sheetTitle}>{UI_TEXT.BACKGROUND_CUSTOM}</h2>
            <button onClick={() => close()} aria-label={UI_TEXT.CLOSE}>
              {UI_TEXT.CLOSE}
            </button>
          </div>
          <div className={styles.sheetBody}>
            <div className={styles.settingsNativeList}>
              <div className={styles.customBackgroundPanel}>
                {customBackgroundPreviewUrl ? (
                  <div
                    className={styles.customBackgroundPreview}
                    role="img"
                    aria-label={UI_TEXT.BACKGROUND_PREVIEW}
                    style={{
                      backgroundImage: `url(${customBackgroundPreviewUrl})`,
                    }}
                  />
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
              <button
                className={styles.settingsNavRow}
                onClick={() => backgroundInputRef.current?.click()}
              >
                <span className={styles.settingsRowText}>
                  <strong>{UI_TEXT.CHANGE_BACKGROUND_IMAGE}</strong>
                </span>
                <span className={styles.continueChevron}>{"\u203a"}</span>
              </button>
              <button
                className={styles.settingsNavRow}
                onClick={() => close(onClearBackground)}
              >
                <span className={styles.settingsRowText}>
                  <strong>{UI_TEXT.REMOVE_BACKGROUND_IMAGE}</strong>
                </span>
                <span className={styles.continueChevron}>{"\u203a"}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </BottomSheet>
  );
}
