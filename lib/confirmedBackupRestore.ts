import type { ReaderPositionCoordinator } from "./readerPositionCoordinator";
import { waitForBackupTasks } from "./backupPresentation";

export async function executeConfirmedBackupRestore<T>(options: {
  acquire: () => Promise<() => Promise<void>>;
  coordinator: ReaderPositionCoordinator;
  stopTasks: () => Promise<unknown>[];
  stopReader: () => void;
  restore: () => Promise<T>;
  reload: () => Promise<void>;
}): Promise<T> {
  const release = await options.acquire();
  options.coordinator.setBlocked(true);
  try {
    await waitForBackupTasks([options.coordinator.cancel(), ...options.stopTasks()]);
    options.stopReader();
    const result = await options.restore();
    await options.reload();
    return result;
  } finally {
    options.coordinator.setBlocked(false);
    await release();
  }
}
