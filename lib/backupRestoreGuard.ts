import type { ReaderPositionCoordinator } from "./readerPositionCoordinator";

export async function runBackupRestoreGuarded(options: {
  coordinator: ReaderPositionCoordinator;
  stopReader: () => void;
  restore: () => Promise<void>;
  reload: () => Promise<void>;
}): Promise<void> {
  options.coordinator.setBlocked(true);
  try {
    await options.coordinator.cancel();
    options.stopReader();
    await options.restore();
    await options.reload();
  } finally {
    options.coordinator.setBlocked(false);
  }
}
