import { describe, expect, it } from "vitest";
import {
  createReaderChromeState,
  reduceReaderChromeState,
} from "./readerChromeState";

describe("reader chrome interaction state", () => {
  it("keeps first-use controls visible until the first explicit tap", () => {
    const pending = reduceReaderChromeState(
      createReaderChromeState(false),
      { type: "require-discovery" }
    );

    expect(pending).toMatchObject({
      visible: true,
      discoveryPending: true,
    });
    expect(
      reduceReaderChromeState(pending, { type: "scroll", at: 500 })
    ).toBe(pending);
    expect(reduceReaderChromeState(pending, { type: "hide" })).toBe(pending);
    expect(
      reduceReaderChromeState(pending, { type: "tap", at: 600 })
    ).toMatchObject({
      visible: false,
      discoveryPending: false,
    });
  });

  it("toggles immediately on consecutive taps", () => {
    const initial = createReaderChromeState(false);
    const shown = reduceReaderChromeState(initial, { type: "tap", at: 100 });
    const hidden = reduceReaderChromeState(shown, { type: "tap", at: 140 });

    expect(shown.visible).toBe(true);
    expect(hidden.visible).toBe(false);
  });

  it("keeps chrome visible when a residual scroll follows a tap", () => {
    const shown = reduceReaderChromeState(createReaderChromeState(false), {
      type: "tap",
      at: 100,
    });

    expect(
      reduceReaderChromeState(shown, { type: "scroll", at: 260 }).visible
    ).toBe(true);
  });

  it("hides chrome for a deliberate later scroll", () => {
    const shown = reduceReaderChromeState(createReaderChromeState(false), {
      type: "tap",
      at: 100,
    });

    expect(
      reduceReaderChromeState(shown, { type: "scroll", at: 500 }).visible
    ).toBe(false);
  });

  it("shows chrome for a text selection and supports an explicit hide", () => {
    const selected = reduceReaderChromeState(createReaderChromeState(false), {
      type: "selection",
    });
    const hidden = reduceReaderChromeState(selected, { type: "hide" });

    expect(selected.visible).toBe(true);
    expect(hidden.visible).toBe(false);
  });
});
