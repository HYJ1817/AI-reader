export type EpubTouchEndClassification = "tap" | "selection" | "ignore";

export function normalizeEpubSelectionText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function classifyEpubTouchEnd({
  startSelectionText,
  endSelectionText,
  isInteractiveTarget,
  scrollIntentFired,
  isTapGesture,
}: {
  startSelectionText: string;
  endSelectionText: string;
  isInteractiveTarget: boolean;
  scrollIntentFired: boolean;
  isTapGesture: boolean;
}): EpubTouchEndClassification {
  if (isInteractiveTarget || scrollIntentFired || !isTapGesture) {
    return "ignore";
  }

  const startSelection = normalizeEpubSelectionText(startSelectionText);
  const endSelection = normalizeEpubSelectionText(endSelectionText);
  if (endSelection && endSelection !== startSelection) {
    return "selection";
  }

  return "tap";
}

const SYNTHETIC_CLICK_SUPPRESSION_MS = 1500;

export type EpubSyntheticClickToken = {
  target: EventTarget | null;
  expiresAt: number;
};

export function createEpubSyntheticClickToken(
  target: EventTarget | null,
  at: number
): EpubSyntheticClickToken {
  return {
    target,
    expiresAt: at + SYNTHETIC_CLICK_SUPPRESSION_MS,
  };
}

export function consumeEpubSyntheticClick({
  token,
  target,
  at,
}: {
  token: EpubSyntheticClickToken | null;
  target: EventTarget | null;
  at: number;
}): {
  suppress: boolean;
  token: EpubSyntheticClickToken | null;
} {
  if (!token) {
    return { suppress: false, token: null };
  }
  if (at > token.expiresAt) {
    return { suppress: false, token: null };
  }
  if (target !== token.target) {
    return { suppress: false, token };
  }
  return { suppress: true, token: null };
}
