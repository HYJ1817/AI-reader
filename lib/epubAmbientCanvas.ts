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

const MEDIA_TAGS = new Set(["IMG", "SVG", "VIDEO", "CANVAS", "PICTURE"]);

function setCanvasBackgroundColor(
  element: EpubAmbientElement | undefined,
  canvasBackground: string
) {
  element?.style?.setProperty(
    "background-color",
    canvasBackground,
    "important"
  );
}

function setCanvasBackground(
  element: EpubAmbientElement | undefined,
  canvasBackground: string
) {
  element?.style?.setProperty("background", canvasBackground, "important");
  setCanvasBackgroundColor(element, canvasBackground);
}

function applyNestedCanvasBackground(
  element: EpubAmbientElement,
  canvasBackground: string
) {
  for (const child of Array.from(element.children ?? [])) {
    if (!MEDIA_TAGS.has(child.tagName?.toUpperCase() ?? "")) {
      setCanvasBackground(child, canvasBackground);
    }
    applyNestedCanvasBackground(child, canvasBackground);
  }
}

export function applyEpubAmbientCanvas(
  contents: unknown,
  canvasBackground = "transparent"
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

  setCanvasBackground(document.documentElement, canvasBackground);
  setCanvasBackground(body, canvasBackground);
  applyNestedCanvasBackground(body, canvasBackground);
}

export function applyEpubViewTransparency(
  view: unknown,
  canvasBackground = "transparent"
): void {
  if (!view || typeof view !== "object") return;
  const candidate = view as EpubAmbientView;
  for (const element of [candidate.container, candidate.element, candidate.iframe]) {
    setCanvasBackground(element, canvasBackground);
  }
  candidate.iframe?.setAttribute?.("allowtransparency", "true");
}
