import { scrollTopFromProgress } from "./txtReader";

export function preserveScrollProgressOnContentResize(
  reader: HTMLElement,
  getProgress: () => number
): () => void {
  let scrollHeight = reader.scrollHeight;
  let clientHeight = reader.clientHeight;
  const observer = new ResizeObserver(() => {
    const nextHeight = reader.scrollHeight;
    const nextClientHeight = reader.clientHeight;
    if (nextHeight === scrollHeight && nextClientHeight === clientHeight) return;
    scrollHeight = nextHeight;
    clientHeight = nextClientHeight;
    reader.scrollTop = scrollTopFromProgress(
      getProgress(),
      nextHeight,
      nextClientHeight
    );
  });
  observer.observe(reader);
  const observeChunks = (root: ParentNode) => {
    root.querySelectorAll<HTMLElement>("[data-reader-paragraph-chunk]").forEach(
      (chunk) => observer.observe(chunk)
    );
  };
  observeChunks(reader);

  const mutations = typeof MutationObserver === "undefined" ? null : new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches("[data-reader-paragraph-chunk]")) observer.observe(node);
        observeChunks(node);
      });
    }
  });
  mutations?.observe(reader, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    mutations?.disconnect();
  };
}
