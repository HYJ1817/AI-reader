type EpubAmbientStyle = {
  setProperty: (property: string, value: string, priority?: string) => void;
};

type EpubAmbientElement = {
  tagName?: string;
  style?: EpubAmbientStyle;
  children?: ArrayLike<EpubAmbientElement>;
  ownerDocument?: EpubAmbientDocument;
  document?: EpubAmbientDocument;
  setAttribute?: (name: string, value: string) => void;
};

type EpubAmbientDocument = {
  documentElement?: EpubAmbientElement;
  body?: EpubAmbientElement;
};

type EpubAmbientContents = EpubAmbientDocument & {
  document?: EpubAmbientDocument;
  content?: EpubAmbientElement;
};

type EpubAmbientView = {
  element?: EpubAmbientElement;
  iframe?: EpubAmbientElement;
  container?: EpubAmbientElement;
};

const TOP_LEVEL_CANVAS_TAGS = new Set([
  "DIV",
  "MAIN",
  "SECTION",
  "ARTICLE",
]);

function setTransparentBackgroundColor(element: EpubAmbientElement | undefined) {
  element?.style?.setProperty("background-color", "transparent", "important");
}

function setTransparentRootCanvas(element: EpubAmbientElement | undefined) {
  element?.style?.setProperty("background", "transparent", "important");
  setTransparentBackgroundColor(element);
}

function clearNestedCanvasColors(element: EpubAmbientElement) {
  for (const child of Array.from(element.children ?? [])) {
    if (TOP_LEVEL_CANVAS_TAGS.has(child.tagName?.toUpperCase() ?? "")) {
      setTransparentBackgroundColor(child);
    }
    clearNestedCanvasColors(child);
  }
}

export function applyEpubAmbientCanvas(
  contents: unknown
): void {
  if (!contents || typeof contents !== "object") return;

  const candidate = contents as EpubAmbientContents;
  const document =
    candidate.document ??
    candidate.content?.ownerDocument ??
    candidate.content?.document ??
    (candidate.body ? candidate : undefined);
  const body = document?.body;
  if (!document || !body) return;

  setTransparentRootCanvas(document.documentElement);
  setTransparentRootCanvas(body);
  clearNestedCanvasColors(body);
}

export function applyEpubViewTransparency(view: unknown): void {
  if (!view || typeof view !== "object") return;
  const candidate = view as EpubAmbientView;
  for (const element of [candidate.container, candidate.element, candidate.iframe]) {
    setTransparentRootCanvas(element);
  }
  candidate.iframe?.setAttribute?.("allowtransparency", "true");
}
