import { describe, expect, it, vi } from "vitest";
import { applyEpubAmbientCanvas } from "./epubAmbientCanvas";

type FakeElement = {
  tagName: string;
  style: {
    setProperty: ReturnType<typeof vi.fn>;
  };
  children: FakeElement[];
  ownerDocument?: FakeDocument;
};

type FakeDocument = {
  documentElement: FakeElement;
  body: FakeElement;
};

function createElement(tagName: string, children: FakeElement[] = []): FakeElement {
  return {
    tagName,
    style: {
      setProperty: vi.fn(),
    },
    children,
  };
}

function createDocument(children: FakeElement[]): FakeDocument {
  return {
    documentElement: createElement("HTML"),
    body: createElement("BODY", children),
  };
}

describe("applyEpubAmbientCanvas", () => {
  it("clears only the document canvas and direct publisher canvas children", () => {
    const nestedCallout = createElement("DIV");
    const nestedCode = createElement("CODE");
    const topLevelDiv = createElement("DIV", [nestedCallout, nestedCode]);
    const topLevelMain = createElement("MAIN");
    const topLevelParagraph = createElement("P");
    const topLevelCode = createElement("CODE");
    const document = createDocument([
      topLevelDiv,
      topLevelMain,
      topLevelParagraph,
      topLevelCode,
    ]);

    applyEpubAmbientCanvas({ document });

    for (const element of [
      document.documentElement,
      document.body,
      topLevelDiv,
      topLevelMain,
    ]) {
      expect(element.style.setProperty).toHaveBeenCalledOnce();
      expect(element.style.setProperty).toHaveBeenCalledWith(
        "background",
        "transparent",
        "important"
      );
    }
    for (const element of [
      topLevelParagraph,
      topLevelCode,
      nestedCallout,
      nestedCode,
    ]) {
      expect(element.style.setProperty).not.toHaveBeenCalled();
    }
  });

  it("uses the content owner document when contents.document is unavailable", () => {
    const document = createDocument([createElement("SECTION")]);
    const content = createElement("BODY");
    content.ownerDocument = document;

    applyEpubAmbientCanvas({ content });

    expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
      "background",
      "transparent",
      "important"
    );
    expect(document.body.children[0]?.style.setProperty).toHaveBeenCalledWith(
      "background",
      "transparent",
      "important"
    );
  });

  it("is a safe no-op without a usable document or body", () => {
    expect(() => applyEpubAmbientCanvas(null)).not.toThrow();
    expect(() => applyEpubAmbientCanvas({})).not.toThrow();
    expect(() =>
      applyEpubAmbientCanvas({
        document: {
          documentElement: createElement("HTML"),
        },
      })
    ).not.toThrow();
  });
});
