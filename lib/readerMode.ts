export type ReaderMode = "scroll" | "paged";

export const DEFAULT_READER_MODE: ReaderMode = "scroll";

export function sanitizeReaderMode(value: unknown): ReaderMode {
  return value === "paged" ? "paged" : DEFAULT_READER_MODE;
}
