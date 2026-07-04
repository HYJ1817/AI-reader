const DEFAULT_REVOKE_DELAY_MS = 30_000;

export function triggerBlobDownload(
  blob: Blob,
  fileName: string,
  revokeDelayMs = DEFAULT_REVOKE_DELAY_MS
): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    anchor.remove();
  }, revokeDelayMs);
}
