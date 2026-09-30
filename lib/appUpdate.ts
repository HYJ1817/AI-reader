export type UpdateProtection = { label: string; dirty?: boolean; busy?: boolean; stop?: () => Promise<void> };
export type AppUpdateState = {
  runningBuild: string;
  candidateBuild: string | null;
  deferredBuild: string | null;
  updating: boolean;
  error: string | null;
};
type UpdateActions = {
  confirm: (message: string) => Promise<boolean>;
  flush: () => Promise<void>;
  activate: () => Promise<void>;
  reload: () => void;
};

async function drainUpdateTasks(tasks: Promise<void>[]) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([Promise.all(tasks), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("update-timeout")), 10_000); })]);
  } finally { clearTimeout(timer); }
}

export function createAppUpdateController(runningBuild: string) {
  let state: AppUpdateState = { runningBuild, candidateBuild: null, deferredBuild: null, updating: false, error: null };
  const listeners = new Set<() => void>();
  const protections = new Map<string | symbol, UpdateProtection>();
  const publish = (next: Partial<AppUpdateState>) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  };
  const blockers = () => [...protections.values()].filter((item) => item.busy && !item.stop);
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    discover(build: string) {
      if (!build || build === state.runningBuild || build === state.candidateBuild) return;
      publish({ candidateBuild: build, error: null });
    },
    defer(build = state.candidateBuild) { publish({ deferredBuild: build, error: null }); },
    protect(key: string | symbol, protection: UpdateProtection) { protections.set(key, protection); },
    unprotect(key: string | symbol) { protections.delete(key); },
    async request(actions: UpdateActions) {
      if (!state.candidateBuild || state.updating) return;
      const blocked = blockers();
      if (blocked.length) { publish({ error: `${blocked.map((item) => item.label).join("、")}正在进行，请完成后再更新。` }); return; }
      publish({ updating: true, error: null });
      try {
        const dirty = [...protections.values()].filter((item) => item.dirty);
        const active = [...protections.values()].filter((item) => item.busy && item.stop);
        const messages = [
          ...(dirty.length ? [`${dirty.map((item) => item.label).join("、")}有未保存的修改，更新会丢弃这些草稿。`] : []),
          ...(active.length ? [`${active.map((item) => item.label).join("、")}正在运行，更新会停止并保存已收到的内容。`] : []),
        ];
        if (messages.length && !(await actions.confirm(`${messages.join("\n")}\n确定更新？选择取消可继续当前操作。`))) {
          publish({ updating: false }); return;
        }
        if (blockers().length) throw new Error("busy");
        const stops = [...protections.values()].filter((item) => item.busy && item.stop).map((item) => item.stop!());
        await drainUpdateTasks(stops);
        await actions.flush();
        if (blockers().length) throw new Error("busy");
        await actions.activate();
        actions.reload();
      } catch {
        publish({ updating: false, error: "更新已取消：仍有未保存的内容或后台任务。请处理后重试，当前页面已保留。" });
      }
    },
  };
}

export const appUpdate = createAppUpdateController(process.env.NEXT_PUBLIC_READER_BUILD_ID ?? "development");
