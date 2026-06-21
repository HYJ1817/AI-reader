import type { ReaderMode } from "./readerMode";

export type EpubRenditionOptions = {
  width: "100%";
  height: "100%";
  spread: "none";
  flow: "scrolled" | "paginated";
  manager: "continuous" | "default";
  overflow: "auto" | "hidden";
};

export function getEpubRenditionOptions(
  mode: ReaderMode
): EpubRenditionOptions {
  if (mode === "paged") {
    return {
      width: "100%",
      height: "100%",
      spread: "none",
      flow: "paginated",
      manager: "default",
      overflow: "hidden",
    };
  }

  return {
    width: "100%",
    height: "100%",
    spread: "none",
    flow: "scrolled",
    manager: "continuous",
    overflow: "auto",
  };
}
