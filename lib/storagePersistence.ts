export type StoragePersistenceStatus =
  | "persistent"
  | "best-effort"
  | "unavailable";

type StorageManagerLike = {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
};

export async function requestPersistentStorage(
  storage: StorageManagerLike | undefined =
    typeof navigator !== "undefined" ? navigator.storage : undefined
): Promise<StoragePersistenceStatus> {
  if (!storage?.persist) return "unavailable";
  try {
    if (storage.persisted && (await storage.persisted())) return "persistent";
    return (await storage.persist()) ? "persistent" : "best-effort";
  } catch {
    return "unavailable";
  }
}
