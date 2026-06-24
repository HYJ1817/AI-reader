import { describe, expect, it } from "vitest";
import {
  cancelEpubSyntheticClickToken,
  consumeEpubSyntheticClick,
  normalizeEpubSelectionText,
  resolveEpubSelectionUpdate,
  shouldReportEpubSelectionChange,
  resolveEpubTouchEnd,
} from "./epubTapInteractions";

describe("normalizeEpubSelectionText", () => {
  it("trims and collapses selection whitespace for stable snapshots", () => {
    expect(normalizeEpubSelectionText("  first \n\t second  ")).toBe(
      "first second"
    );
  });
});

describe("resolveEpubSelectionUpdate", () => {
  it("clears stale AI selection state without showing selection chrome", () => {
    expect(resolveEpubSelectionUpdate(" \n\t ")).toEqual({
      selectedText: null,
      shouldShowChrome: false,
    });
  });

  it("normalizes selected text and requests selection chrome", () => {
    expect(resolveEpubSelectionUpdate("  first \n second  ")).toEqual({
      selectedText: "first second",
      shouldShowChrome: true,
    });
  });
});

describe("shouldReportEpubSelectionChange", () => {
  it("suppresses Safari replaying a stale non-empty selection after a tap", () => {
    expect(
      shouldReportEpubSelectionChange({
        value: "stale selection",
        at: 1200,
        suppressNonEmptyUntil: 1300,
      })
    ).toBe(false);
  });

  it("still reports clears and later genuine selections", () => {
    expect(
      shouldReportEpubSelectionChange({
        value: "",
        at: 1200,
        suppressNonEmptyUntil: 1300,
      })
    ).toBe(true);
    expect(
      shouldReportEpubSelectionChange({
        value: "new selection",
        at: 1400,
        suppressNonEmptyUntil: 1300,
      })
    ).toBe(true);
  });
});

describe("resolveEpubTouchEnd", () => {
  it("creates a synthetic-click token only for a real tap", () => {
    const target = new EventTarget();
    const result = resolveEpubTouchEnd({
      startSelectionText: "",
      endSelectionText: "",
      isInteractiveTarget: false,
      scrollIntentFired: false,
      isTapGesture: true,
      target,
      at: 100,
    });

    expect(result.classification).toBe("tap");
    expect(result.fireTap).toBe(true);
    expect(result.syntheticClickToken?.target).toBe(target);
  });

  it("treats a new non-empty selection as selection without a token", () => {
    expect(
      resolveEpubTouchEnd({
        startSelectionText: "",
        endSelectionText: "selected text",
        isInteractiveTarget: false,
        scrollIntentFired: false,
        isTapGesture: true,
        target: new EventTarget(),
        at: 100,
      })
    ).toEqual({
      classification: "selection",
      fireTap: false,
      syntheticClickToken: null,
    });
  });

  it("allows a stationary tap when the non-empty selection is unchanged", () => {
    const result = resolveEpubTouchEnd({
      startSelectionText: "stale selection",
      endSelectionText: "stale selection",
      isInteractiveTarget: false,
      scrollIntentFired: false,
      isTapGesture: true,
      target: new EventTarget(),
      at: 100,
    });

    expect(result.classification).toBe("tap");
    expect(result.fireTap).toBe(true);
    expect(result.syntheticClickToken).not.toBeNull();
  });

  it("does not create a token for interactive, scroll, or swipe gestures", () => {
    const base = {
      startSelectionText: "",
      endSelectionText: "",
      target: new EventTarget(),
      at: 100,
    };

    expect(
      resolveEpubTouchEnd({
        ...base,
        isInteractiveTarget: true,
        scrollIntentFired: false,
        isTapGesture: true,
      })
    ).toMatchObject({
      classification: "ignore",
      fireTap: false,
      syntheticClickToken: null,
    });
    expect(
      resolveEpubTouchEnd({
        ...base,
        isInteractiveTarget: false,
        scrollIntentFired: true,
        isTapGesture: true,
      })
    ).toMatchObject({
      classification: "ignore",
      fireTap: false,
      syntheticClickToken: null,
    });
    expect(
      resolveEpubTouchEnd({
        ...base,
        isInteractiveTarget: false,
        scrollIntentFired: false,
        isTapGesture: false,
      })
    ).toMatchObject({
      classification: "ignore",
      fireTap: false,
      syntheticClickToken: null,
    });
  });
});

describe("EPUB synthetic click suppression", () => {
  it("runs a touchend and matching click sequence as exactly one tap", () => {
    const target = new EventTarget();
    const touchEnd = resolveEpubTouchEnd({
      startSelectionText: "",
      endSelectionText: "",
      isInteractiveTarget: false,
      scrollIntentFired: false,
      isTapGesture: true,
      target,
      at: 100,
    });
    let tapCount = touchEnd.fireTap ? 1 : 0;
    const consumed = consumeEpubSyntheticClick({
      token: touchEnd.syntheticClickToken,
      target,
      at: 950,
    });
    if (!consumed.suppress) tapCount += 1;

    expect(tapCount).toBe(1);
    expect(consumed.suppress).toBe(true);
    expect(consumed.token).toBeNull();
  });

  it("allows a different target click and clears the stale token", () => {
    const touchTarget = new EventTarget();
    const clickTarget = new EventTarget();
    const token = resolveEpubTouchEnd({
      startSelectionText: "",
      endSelectionText: "",
      isInteractiveTarget: false,
      scrollIntentFired: false,
      isTapGesture: true,
      target: touchTarget,
      at: 100,
    }).syntheticClickToken;
    const result = consumeEpubSyntheticClick({
      token,
      target: clickTarget,
      at: 200,
    });

    expect(result.suppress).toBe(false);
    expect(result.token).toBeNull();
  });

  it("allows an expired click and clears the token", () => {
    const target = new EventTarget();
    const token = resolveEpubTouchEnd({
      startSelectionText: "",
      endSelectionText: "",
      isInteractiveTarget: false,
      scrollIntentFired: false,
      isTapGesture: true,
      target,
      at: 100,
    }).syntheticClickToken;

    expect(
      consumeEpubSyntheticClick({
        token,
        target,
        at: 1601,
      })
    ).toEqual({ suppress: false, token: null });
  });

  it("clears a pending token when the touch sequence is cancelled", () => {
    const target = new EventTarget();
    const token = resolveEpubTouchEnd({
      startSelectionText: "",
      endSelectionText: "",
      isInteractiveTarget: false,
      scrollIntentFired: false,
      isTapGesture: true,
      target,
      at: 100,
    }).syntheticClickToken;

    const cancelledToken = cancelEpubSyntheticClickToken();

    expect(token).not.toBeNull();
    expect(cancelledToken).toBeNull();
    expect(
      consumeEpubSyntheticClick({
        token: cancelledToken,
        target,
        at: 200,
      })
    ).toEqual({ suppress: false, token: null });
  });
});
