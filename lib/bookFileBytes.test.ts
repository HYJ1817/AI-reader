import { expect, it, vi } from "vitest";
import { readBookFileBytes, rememberBookFileBytes } from "./bookFileBytes";

it("reuses the original input allocation without rereading its Blob", async () => {
  const buffer = new Uint8Array([1, 2, 3]).buffer;
  const blob = new Blob([buffer]);
  const read = vi.spyOn(blob, "arrayBuffer");
  rememberBookFileBytes(blob, buffer);
  expect(await readBookFileBytes(blob)).toBe(buffer);
  expect(read).not.toHaveBeenCalled();
});
