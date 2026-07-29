export function isWorkspaceNearBottom(
  scrollHeight: number,
  clientHeight: number,
  scrollTop: number,
  threshold = 48
): boolean {
  return scrollHeight - scrollTop - clientHeight <= threshold;
}

export function shouldFollowWorkspaceViewport(input: {
  nearBottom: boolean;
  userInteracting: boolean;
  visible: boolean;
}): boolean {
  return input.nearBottom && !input.userInteracting && input.visible;
}

export function getAnchoredPrependScrollTop(input: {
  currentScrollTop: number;
  previousAnchorTop: number;
  nextAnchorTop: number;
}): number {
  return input.currentScrollTop + input.nextAnchorTop - input.previousAnchorTop;
}
