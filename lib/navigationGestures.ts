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
