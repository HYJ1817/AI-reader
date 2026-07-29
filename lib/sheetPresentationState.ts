export type SheetCloseCallback = (() => void) | null;

export type SheetCloseRequestGuard = {
  request: (afterClose?: () => void) => boolean;
  takeCallback: () => SheetCloseCallback;
  reset: () => void;
  hasRequest: () => boolean;
};

export function createSheetCloseRequestGuard(): SheetCloseRequestGuard {
  let requested = false;
  let callback: SheetCloseCallback = null;

  return {
    request(afterClose) {
      if (requested) return false;
      requested = true;
      callback = afterClose ?? null;
      return true;
    },
    takeCallback() {
      const pendingCallback = callback;
      callback = null;
      return pendingCallback;
    },
    reset() {
      requested = false;
      callback = null;
    },
    hasRequest() {
      return requested;
    },
  };
}

export function shouldCommitSheetExit({
  open,
  requestedGeneration,
  currentGeneration,
  completedGeneration,
}: {
  open: boolean;
  requestedGeneration: number;
  currentGeneration: number;
  completedGeneration: number;
}): boolean {
  return (
    !open &&
    requestedGeneration === currentGeneration &&
    completedGeneration < requestedGeneration
  );
}
