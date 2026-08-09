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

export function getWorkspaceManualScrollOwnership(input: {
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
}): {
  nearBottom: boolean;
  manualAway: boolean;
  ownedScrollTop: number | null;
} {
  const nearBottom = isWorkspaceNearBottom(
    input.scrollHeight,
    input.clientHeight,
    input.scrollTop
  );
  return {
    nearBottom,
    manualAway: !nearBottom,
    ownedScrollTop: nearBottom ? null : input.scrollTop,
  };
}

export function shouldRestoreWorkspacePrependAnchor(
  interactionGenerationBefore: number,
  interactionGenerationAfter: number
): boolean {
  return interactionGenerationBefore === interactionGenerationAfter;
}

export function hasWorkspacePrependDomCommitted(input: {
  previousMessageCount: number;
  nextMessageCount: number;
  hadPrependControl: boolean;
  hasPrependControl: boolean;
}): boolean {
  return (
    input.nextMessageCount !== input.previousMessageCount ||
    input.hasPrependControl !== input.hadPrependControl
  );
}

export function getAnchoredPrependScrollTop(input: {
  currentScrollTop: number;
  previousAnchorTop: number;
  nextAnchorTop: number;
}): number {
  return input.currentScrollTop + input.nextAnchorTop - input.previousAnchorTop;
}
