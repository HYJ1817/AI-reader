import { describe, expect, it, vi } from "vitest";
import { createLocalId } from "./localId";

describe("createLocalId", () => {
  it("uses a callable randomUUID", () => {
    expect(createLocalId({ randomUUID: () => "uuid-1" })).toBe("uuid-1");
  });

  it("falls back when old Android has no callable randomUUID", () => {
    const id = createLocalId(
      { randomUUID: undefined },
      () => 1720000000000,
      vi.fn(() => 0.25)
    );
    expect(id).toMatch(/^local-1720000000000-[a-z0-9]{7}$/);
  });
});
