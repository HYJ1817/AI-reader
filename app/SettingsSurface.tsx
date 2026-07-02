"use client";

import type {
  ChangeEventHandler,
  RefObject,
} from "react";
import type { AppPreferences } from "@/lib/appPreferences";
import { UI_TEXT } from "@/lib/uiText";
import styles from "./page.module.css";

export type SettingsSurfaceProps = {
  className: string;
  ariaHidden: boolean;
  appPreferences: AppPreferences;
  activeProviderLabel: string | null;
  readerThemeLabel: string;
  todayMinutes: number;
  targetMinutes: number;
  backupStatus: string | null;
  backupError: string | null;
  backupInputRef: RefObject<HTMLInputElement | null>;
  backgroundInputRef: RefObject<HTMLInputElement | null>;
  customBackgroundAvailable: boolean;
  customBackgroundPreviewUrl: string | null;
  onPreferencesChange: (next: Partial<AppPreferences>) => void;
  onBackgroundModeChange: (mode: AppPreferences["backgroundMode"]) => void;
  onImportBackground: ChangeEventHandler<HTMLInputElement>;
  onClearBackground: () => void;
  onOpenAiSettings: () => void;
  onExportBackup: () => void;
  onImportBackup: ChangeEventHandler<HTMLInputElement>;
  onOpenReaderSettings: () => void;
  onOpenGoal: () => void;
};

export default function SettingsSurface({
  className,
  ariaHidden,
  appPreferences,
  activeProviderLabel,
  readerThemeLabel,
  todayMinutes,
  targetMinutes,
  backupStatus,
  backupError,
  backupInputRef,
  backgroundInputRef,
  customBackgroundAvailable,
  customBackgroundPreviewUrl,
  onPreferencesChange,
  onBackgroundModeChange,
  onImportBackground,
  onClearBackground,
  onOpenAiSettings,
  onExportBackup,
  onImportBackup,
  onOpenReaderSettings,
  onOpenGoal,
}: SettingsSurfaceProps) {
  const customBackgroundStatus = customBackgroundAvailable
    ? UI_TEXT.BACKGROUND_CUSTOM_READY
    : UI_TEXT.BACKGROUND_CUSTOM_EMPTY;
  const customBackgroundOpacityPercent = Math.round(
    appPreferences.customBackgroundOpacity * 100
  );

  return (
    <div className={className} aria-hidden={ariaHidden}>
      <h1 className={styles.libraryTitle}>{UI_TEXT.SETTINGS}</h1>

      <section className={styles.settingsSection}>
        <h2 className={styles.settingsSectionTitle}>
          {UI_TEXT.APP_PREFERENCES}
        </h2>
        <div className={styles.settingsNativeList}>
          <label className={styles.settingsSwitchRow}>
            <span className={styles.settingsRowText}>
              <strong>{UI_TEXT.AUTO_OPEN_LAST_BOOK}</strong>
            </span>
            <input
              type="checkbox"
              className={styles.iosSwitch}
              checked={appPreferences.autoOpenLastBook}
              onChange={(event) =>
                onPreferencesChange({
                  autoOpenLastBook: event.target.checked,
                })
              }
            />
          </label>

          <label className={styles.settingsSwitchRow}>
            <span className={styles.settingsRowText}>
              <strong>{UI_TEXT.KEEP_SCREEN_AWAKE}</strong>
            </span>
            <input
              type="checkbox"
              className={styles.iosSwitch}
              checked={appPreferences.keepScreenAwake}
              onChange={(event) =>
                onPreferencesChange({
                  keepScreenAwake: event.target.checked,
                })
              }
            />
          </label>

          <label className={styles.settingsSwitchRow}>
            <span className={styles.settingsRowText}>
              <strong>{UI_TEXT.REDUCE_MOTION}</strong>
            </span>
            <input
              type="checkbox"
              className={styles.iosSwitch}
              checked={appPreferences.reduceMotion}
              onChange={(event) =>
                onPreferencesChange({ reduceMotion: event.target.checked })
              }
            />
          </label>
        </div>
      </section>

      <section className={styles.settingsSection}>
        <h2 className={styles.settingsSectionTitle}>
          {UI_TEXT.READING_GESTURES}
        </h2>
        <div className={styles.settingsNativeList}>
          <label className={styles.settingsSwitchRow}>
            <span className={styles.settingsRowText}>
              <strong>{UI_TEXT.SWIPE_TO_TURN}</strong>
            </span>
            <input
              type="checkbox"
              className={styles.iosSwitch}
              checked={appPreferences.swipeToTurn}
              onChange={(event) =>
                onPreferencesChange({ swipeToTurn: event.target.checked })
              }
            />
          </label>
        </div>
      </section>

      <section className={styles.settingsSection}>
        <h2 className={styles.settingsSectionTitle}>{UI_TEXT.BACKGROUND}</h2>
        <div className={styles.settingsNativeList}>
          <button
            className={styles.settingsNavRow}
            aria-pressed={appPreferences.backgroundMode === "auto"}
            onClick={() => onBackgroundModeChange("auto")}
          >
            <span className={styles.settingsRowText}>
              <strong>{UI_TEXT.BACKGROUND_AUTO}</strong>
              <small>{UI_TEXT.BACKGROUND_AUTO_HINT}</small>
            </span>
            <span className={styles.continueChevron}>
              {appPreferences.backgroundMode === "auto" ? "\u2713" : "\u203a"}
            </span>
          </button>

          <button
            className={styles.settingsNavRow}
            aria-pressed={appPreferences.backgroundMode === "custom"}
            onClick={() => {
              if (customBackgroundAvailable) {
                onBackgroundModeChange("custom");
                return;
              }
              backgroundInputRef.current?.click();
            }}
          >
            <span className={styles.settingsRowText}>
              <strong>{UI_TEXT.BACKGROUND_CUSTOM}</strong>
              <small>{customBackgroundStatus}</small>
            </span>
            <span className={styles.continueChevron}>
              {appPreferences.backgroundMode === "custom" ? "\u2713" : "\u203a"}
            </span>
          </button>

          <input
            ref={backgroundInputRef}
            type="file"
            accept="image/*"
            className={styles.hiddenInput}
            onChange={onImportBackground}
          />

          {customBackgroundAvailable ? (
            <>
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
                onClick={onClearBackground}
              >
                <span className={styles.settingsRowText}>
                  <strong>{UI_TEXT.REMOVE_BACKGROUND_IMAGE}</strong>
                </span>
                <span className={styles.continueChevron}>{"\u203a"}</span>
              </button>
            </>
          ) : null}
        </div>
      </section>

      <section className={styles.settingsSection}>
        <h2 className={styles.settingsSectionTitle}>
          {UI_TEXT.AI_SETTINGS_TITLE}
        </h2>
        <div className={styles.settingsNativeList}>
          <button
            className={styles.settingsNavRow}
            onClick={onOpenAiSettings}
          >
            <span className={styles.settingsRowText}>
              <strong>AI 服务商</strong>
              <small>{activeProviderLabel ?? "未配置"}</small>
            </span>
            <span className={styles.continueChevron}>{"\u203a"}</span>
          </button>
        </div>
      </section>

      <section className={styles.settingsSection}>
        <h2 className={styles.settingsSectionTitle}>{UI_TEXT.BACKUP}</h2>
        <div className={styles.settingsNativeList}>
          <button
            className={styles.settingsNavRow}
            onClick={onExportBackup}
          >
            <span className={styles.settingsRowText}>
              <strong>{UI_TEXT.EXPORT_BACKUP}</strong>
            </span>
            <span className={styles.continueChevron}>{"\u203a"}</span>
          </button>
          <button
            className={styles.settingsNavRow}
            onClick={() => backupInputRef.current?.click()}
          >
            <span className={styles.settingsRowText}>
              <strong>{UI_TEXT.IMPORT_BACKUP}</strong>
            </span>
            <span className={styles.continueChevron}>{"\u203a"}</span>
          </button>
          <input
            ref={backupInputRef}
            type="file"
            accept=".json"
            className={styles.hiddenInput}
            onChange={onImportBackup}
          />
        </div>
        {backupStatus && (
          <p
            className={`${styles.settingsStatusText} ${styles.settingsStatusOk}`}
          >
            {backupStatus}
          </p>
        )}
        {backupError && (
          <p
            className={`${styles.settingsStatusText} ${styles.settingsStatusErr}`}
          >
            {backupError}
          </p>
        )}
      </section>

      <section className={styles.settingsSection}>
        <h2 className={styles.settingsSectionTitle}>{UI_TEXT.READING}</h2>
        <div className={styles.settingsNativeList}>
          <button
            className={styles.settingsNavRow}
            onClick={onOpenReaderSettings}
          >
            <span className={styles.settingsRowText}>
              <strong>{UI_TEXT.READER_APPEARANCE}</strong>
              <small>{readerThemeLabel}</small>
            </span>
            <span className={styles.continueChevron}>{"\u203a"}</span>
          </button>
          <button className={styles.settingsNavRow} onClick={onOpenGoal}>
            <span className={styles.settingsRowText}>
              <strong>{UI_TEXT.READING_GOAL}</strong>
              <small>
                {UI_TEXT.TODAY_READING} {todayMinutes}/{targetMinutes}{" "}
                {UI_TEXT.MINUTES}
              </small>
            </span>
            <span className={styles.continueChevron}>{"\u203a"}</span>
          </button>
        </div>
      </section>
    </div>
  );
}
