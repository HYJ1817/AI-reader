export function canSheetClaimGesture(input: {
  fromHeader: boolean;
  scrollTop: number;
  deltaY: number;
}): boolean {
  return input.deltaY > 0 && (input.fromHeader || input.scrollTop <= 0);
}

export function shouldCompleteSheetDismiss(
  offsetY: number,
  velocityY: number,
  sheetHeight: number
): boolean {
  const distance = Math.min(140, Math.max(1, sheetHeight) * 0.28);
  return offsetY >= distance || (velocityY >= 900 && offsetY >= 24);
}

export function canStartEdgeBack(input: {
  clientX: number;
  hasPush: boolean;
  inReader: boolean;
}): boolean {
  return (
    input.hasPush &&
    !input.inReader &&
    input.clientX >= 0 &&
    input.clientX <= 20
  );
}

export function shouldCompleteEdgeBack(
  offsetX: number,
  velocityX: number,
  viewportWidth: number
): boolean {
  const width = Math.max(1, viewportWidth);
  return offsetX >= width * 0.3 || (velocityX >= 620 && offsetX >= 28);
}
