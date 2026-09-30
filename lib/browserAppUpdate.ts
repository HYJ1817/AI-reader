import { appUpdate } from "./appUpdate";

export const DEFERRED_UPDATE_KEY = "ai-reader-deferred-update";

export function deferAppUpdate() {
  appUpdate.defer();
  try { sessionStorage.setItem(DEFERRED_UPDATE_KEY, appUpdate.getSnapshot().deferredBuild ?? ""); } catch { /* In-memory snooze still works. */ }
}

async function withDeadline<T>(task: Promise<T>, timeoutMs = 10_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([task, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("update-timeout")), timeoutMs); })]);
  } finally { clearTimeout(timer); }
}

export async function flushBeforeAppReload() {
  const pending: Promise<unknown>[] = [];
  window.dispatchEvent(new CustomEvent("ai-reader-before-reload", {
    detail: { waitUntil: (promise: Promise<unknown>) => pending.push(promise) },
  }));
  await withDeadline(Promise.all(pending));
}

async function activateWaitingWorker() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const waiting = registration?.waiting;
  if (!waiting) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error("activation-timeout")); }, 10_000);
    const changed = () => { cleanup(); resolve(); };
    function cleanup() { clearTimeout(timer); navigator.serviceWorker.removeEventListener("controllerchange", changed); }
    navigator.serviceWorker.addEventListener("controllerchange", changed);
    try { waiting.postMessage({ type: "AI_READER_ACTIVATE" }); }
    catch (error) { cleanup(); reject(error); }
  });
}

export function requestAppUpdate() {
  return appUpdate.request({
    confirm: async (message) => window.confirm(message),
    flush: flushBeforeAppReload,
    activate: () => withDeadline(activateWaitingWorker()),
    reload: () => window.location.reload(),
  });
}
