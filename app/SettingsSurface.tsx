"use client";

import type {
  ChangeEventHandler,
  RefObject,
} from "react";
import { m } from "motion/react";
import { useAppReducedMotion } from "./AppMotionRoot";
import type { AppPreferences } from "@/lib/appPreferences";
import { MOTION_DURATION } from "@/lib/motionSystem";
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
  onPreferencesChange: (next: Partial<AppPreferences>) => void;
  onBackgroundModeChange: (mode: AppPreferences["backgroundMode"]) => void;
  onImportBackground: ChangeEventHandler<HTMLInputElement>;
  onOpenCustomBackgroundSettings: () => void;
  onOpenAiProviders: () => void;
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
  onPreferencesChange,
  onBackgroundModeChange,
  onImportBackground,
  onOpenCustomBackgroundSettings,
  onOpenAiProviders,
  onExportBackup,
  onImportBackup,
  onOpenReaderSettings,
  onOpenGoal,
}: SettingsSurfaceProps) {
  const customBackgroundStatus = customBackgroundAvailable
    ? UI_TEXT.BACKGROUND_CUSTOM_READY
    : UI_TEXT.BACKGROUND_CUSTOM_EMPTY;

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
            <NativeMotionSwitch
              id="auto-open-last-book"
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
            <NativeMotionSwitch
              id="keep-screen-awake"
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
            <NativeMotionSwitch
              id="reduce-motion"
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
            <NativeMotionSwitch
              id="swipe-to-turn"
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
                onOpenCustomBackgroundSettings();
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
            onChange={(event) => {
              const hasFile = Boolean(event.target.files?.[0]);
              onImportBackground(event);
              if (hasFile) onOpenCustomBackgroundSettings();
            }}
          />
        </div>
      </section>

      <section className={styles.settingsSection}>
        <h2 className={styles.settingsSectionTitle}>
          {UI_TEXT.AI_SETTINGS_TITLE}
        </h2>
        <div className={styles.settingsNativeList}>
          <button
            className={styles.settingsNavRow}
            onClick={onOpenAiProviders}
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
            role="status"
          >
            {backupStatus}
          </p>
        )}
        {backupError && (
          <p
            className={`${styles.settingsStatusText} ${styles.settingsStatusErr}`}
            role="alert"
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

function NativeMotionSwitch({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
}) {
  const reduceMotion = useAppReducedMotion();

  return (
    <span className={styles.motionSwitch} data-checked={checked ? "true" : "false"}>
      <input
        id={id}
        type="checkbox"
        className={styles.motionSwitchInput}
        checked={checked}
        onChange={onChange}
      />
      <span className={styles.motionSwitchTrack} aria-hidden="true">
        <m.span
          className={styles.motionSwitchThumbPosition}
          layout={reduceMotion ? false : "position"}
          layoutId={reduceMotion ? undefined : `settings-switch-thumb-${id}`}
          transition={{
            duration: reduceMotion ? 0 : MOTION_DURATION.state,
            ease: [0.32, 0.72, 0, 1],
          }}
        >
          <span className={styles.motionSwitchThumb} />
        </m.span>
      </span>
    </span>
  );
}
