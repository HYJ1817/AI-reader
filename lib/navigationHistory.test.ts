import { describe, expect, it } from "vitest";
import {
  createAppNavigationState,
  type AppNavigationState,
} from "./appNavigation";
import {
  decodeNavigationHistory,
  encodeNavigationHistory,
} from "./navigationHistory";

function createLayeredState(): AppNavigationState {
  return {
    ...createAppNavigationState(),
    activeTab: "settings",
    pushes: [
      {
        key: "push-1",
        kind: "push",
        route: "ai-provider-configure",
        entityId: "provider-1",
        restoreFocusId: "provider-button",
        scrollTop: 120,
      },
    ],
    reader: {
      key: "reader-1",
      kind: "reader",
      bookId: "book-1",
      originId: "book-cover-1",
    },
    sheets: [
      {
        key: "sheet-1",
        kind: "sheet",
        route: "ask-ai",
        entityId: "book-1",
        restoreFocusId: "ask-ai-button",
      },
    ],
    direction: "forward",
    revision: 7,
  };
}

describe("navigation history", () => {
  it("round-trips application navigation state", () => {
    const state = createLayeredState();

    expect(decodeNavigationHistory(encodeNavigationHistory(state))).toEqual(
      state
    );
  });

  it("encodes a versioned application payload", () => {
    const state = createAppNavigationState();

    expect(encodeNavigationHistory(state)).toEqual({
      app: "ai-reader",
      version: 1,
      state,
    });
  });

  it("rejects unrelated and unsupported payloads", () => {
    expect(decodeNavigationHistory(null)).toBeNull();
    expect(decodeNavigationHistory("ai-reader")).toBeNull();
    expect(decodeNavigationHistory({ app: "other", version: 1 })).toBeNull();
    expect(
      decodeNavigationHistory({ app: "ai-reader", version: 99 })
    ).toBeNull();
  });

  it.each([
    ["missing state", undefined],
    ["non-object state", "library"],
    ["unknown active tab", { activeTab: "discover" }],
    ["non-array pushes", { pushes: {} }],
    ["non-array sheets", { sheets: {} }],
    ["invalid reader", { reader: {} }],
    ["unknown direction", { direction: "sideways" }],
    ["negative revision", { revision: -1 }],
    ["fractional revision", { revision: 1.5 }],
  ])("rejects %s", (_label, statePatch) => {
    let value: unknown;

    if (statePatch === undefined) {
      value = { app: "ai-reader", version: 1 };
    } else if (typeof statePatch === "object" && statePatch !== null) {
      value = {
        app: "ai-reader",
        version: 1,
        state: { ...createAppNavigationState(), ...statePatch },
      };
    } else {
      value = { app: "ai-reader", version: 1, state: statePatch };
    }

    expect(decodeNavigationHistory(value)).toBeNull();
  });

  it.each([
    ["wrong kind", { key: "push-1", kind: "sheet", route: "collections" }],
    ["missing key", { kind: "push", route: "collections" }],
    ["unknown route", { key: "push-1", kind: "push", route: "unknown" }],
    [
      "invalid optional entity",
      { key: "push-1", kind: "push", route: "collections", entityId: 1 },
    ],
    [
      "invalid scroll snapshot",
      { key: "push-1", kind: "push", route: "collections", scrollTop: -1 },
    ],
  ])("rejects a push entry with %s", (_label, entry) => {
    expect(
      decodeNavigationHistory({
        app: "ai-reader",
        version: 1,
        state: { ...createAppNavigationState(), pushes: [entry] },
      })
    ).toBeNull();
  });

  it.each([
    ["wrong kind", { key: "sheet-1", kind: "push", route: "ask-ai" }],
    ["missing key", { kind: "sheet", route: "ask-ai" }],
    ["unknown route", { key: "sheet-1", kind: "sheet", route: "unknown" }],
    [
      "invalid focus target",
      {
        key: "sheet-1",
        kind: "sheet",
        route: "ask-ai",
        restoreFocusId: 2,
      },
    ],
  ])("rejects a sheet entry with %s", (_label, entry) => {
    expect(
      decodeNavigationHistory({
        app: "ai-reader",
        version: 1,
        state: { ...createAppNavigationState(), sheets: [entry] },
      })
    ).toBeNull();
  });

  it.each([
    ["wrong kind", { key: "reader-1", kind: "push", bookId: "book-1" }],
    ["missing key", { kind: "reader", bookId: "book-1" }],
    ["missing book", { key: "reader-1", kind: "reader" }],
    [
      "invalid origin",
      { key: "reader-1", kind: "reader", bookId: "book-1", originId: 4 },
    ],
  ])("rejects a reader entry with %s", (_label, reader) => {
    expect(
      decodeNavigationHistory({
        app: "ai-reader",
        version: 1,
        state: { ...createAppNavigationState(), reader },
      })
    ).toBeNull();
  });
});
