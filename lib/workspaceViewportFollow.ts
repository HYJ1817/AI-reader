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

export function getAnchoredPrependScrollTop(
  previousScrollTop: number,
  previousScrollHeight: number,
  nextScrollHeight: number
): number {
  return previousScrollTop + Math.max(0, nextScrollHeight - previousScrollHeight);
}
