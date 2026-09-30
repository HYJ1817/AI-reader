"use client";
import { useSyncExternalStore } from "react";
import { appUpdate } from "@/lib/appUpdate";
import { deferAppUpdate, requestAppUpdate } from "@/lib/browserAppUpdate";
import MotionSheet from "./MotionSheet";
import styles from "./AppUpdateNotice.module.css";

export function AppUpdateSettingsRow() {
  const state = useSyncExternalStore(appUpdate.subscribe, appUpdate.getSnapshot, appUpdate.getSnapshot);
  return <div className={styles.settings}>
    <p>{state.candidateBuild ? "有新版本可用，当前页面不会自动刷新。" : "当前没有待处理更新。"}</p>
    {state.candidateBuild && <button disabled={state.updating} onClick={() => void requestAppUpdate()}>立即更新</button>}
    {state.error && <p role="alert">{state.error}</p>}
  </div>;
}

export default function AppUpdateNotice({ quiet }: { quiet: boolean }) {
  const state = useSyncExternalStore(appUpdate.subscribe, appUpdate.getSnapshot, appUpdate.getSnapshot);
  if (state.updating) return <div data-sheet-route="app-update">
    <MotionSheet open dismissible={false} onRequestClose={() => {}} showGrabber={false} ariaLabel="正在准备更新">
      <p className={styles.progress} role="status">正在保存并准备更新，请勿关闭应用…</p>
    </MotionSheet>
  </div>;
  if (quiet || !state.candidateBuild || state.candidateBuild === state.deferredBuild) return null;
  return <aside className={styles.notice} aria-label="应用更新">
    <p role="status">新版本已就绪，可在方便时更新。</p>
    <div className={styles.actions}>
      <button onClick={() => void requestAppUpdate()}>立即更新</button>
      <button onClick={deferAppUpdate}>稍后</button>
    </div>
    {state.error && <p role="alert">{state.error}</p>}
  </aside>;
}
