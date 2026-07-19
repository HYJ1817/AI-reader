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

function setTransparentBackgroundColor(element: EpubAmbientElement | undefined) {
  element?.style?.setProperty("background-color", "transparent", "important");
}

function setTransparentRootCanvas(element: EpubAmbientElement | undefined) {
  element?.style?.setProperty("background", "transparent", "important");
  setTransparentBackgroundColor(element);
}

function clearNestedCanvases(element: EpubAmbientElement) {
  for (const child of Array.from(element.children ?? [])) {
    if (!MEDIA_TAGS.has(child.tagName?.toUpperCase() ?? "")) {
      setTransparentRootCanvas(child);
    }
    clearNestedCanvases(child);
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
  clearNestedCanvases(body);
}

export function applyEpubViewTransparency(view: unknown): void {
  if (!view || typeof view !== "object") return;
  const candidate = view as EpubAmbientView;
  for (const element of [candidate.container, candidate.element, candidate.iframe]) {
    setTransparentRootCanvas(element);
  }
  candidate.iframe?.setAttribute?.("allowtransparency", "true");
}
