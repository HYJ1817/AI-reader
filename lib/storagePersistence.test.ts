import { describe, expect, it, vi } from "vitest";
import { requestPersistentStorage } from "./storagePersistence";

describe("requestPersistentStorage", () => {
  it("keeps an already persistent storage bucket", async () => {
    const persist = vi.fn(async () => false);
    await expect(
      requestPersistentStorage({ persisted: async () => true, persist })
    ).resolves.toBe("persistent");
    expect(persist).not.toHaveBeenCalled();
  });

  it("requests persistence for a best-effort bucket", async () => {
    await expect(
      requestPersistentStorage({
        persisted: async () => false,
        persist: async () => true,
      })
    ).resolves.toBe("persistent");
  });

  it("reports best-effort when the browser declines", async () => {
    await expect(
      requestPersistentStorage({ persist: async () => false })
    ).resolves.toBe("best-effort");
  });

  it("is safe when the API is missing or throws", async () => {
    await expect(requestPersistentStorage(undefined)).resolves.toBe("unavailable");
    await expect(
      requestPersistentStorage({
        persist: async () => {
          throw new Error("blocked");
        },
      })
    ).resolves.toBe("unavailable");
  });
});
