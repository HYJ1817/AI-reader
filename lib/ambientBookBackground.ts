import { acquireBlobUrl, releaseBlobUrl } from "./blobUrlCache";
import { createFallbackCoverStyle } from "./bookCoverStyle";
import type { BookRecord } from "./db";

export const AMBIENT_CROSSFADE_MS = 340;

export type AmbientLayer = {
  key: string;
  kind: "empty" | "fallback" | "image";
  imageUrl: string | null;
  paper: string | null;
  spine: string | null;
  blob: Blob | null;
};

export type AmbientTransitionState = {
  current: AmbientLayer;
  previous: AmbientLayer | null;
  generation: number;
};

export function createAmbientLayer(
  book: BookRecord | null,
  imageUrl: string | null
): AmbientLayer {
  if (!book) {
    return {
      key: "ambient:none",
      kind: "empty",
      imageUrl: null,
      paper: null,
      spine: null,
      blob: null,
    };
  }

  const fallbackStyle = createFallbackCoverStyle(book.title, book.format);
  const hasImage = Boolean(book.coverImageBlob && imageUrl);

  return {
    key: [
      "ambient",
      book.id,
      book.title,
      book.format,
      hasImage ? imageUrl : "fallback",
    ].join(":"),
    kind: hasImage ? "image" : "fallback",
    imageUrl: hasImage ? imageUrl : null,
    paper: fallbackStyle.paper,
    spine: fallbackStyle.spine,
    blob: hasImage ? book.coverImageBlob ?? null : null,
  };
}

export function createInitialAmbientTransitionState(): AmbientTransitionState {
  return {
    current: createAmbientLayer(null, null),
    previous: null,
    generation: 0,
  };
}

export function startAmbientTransition(
  state: AmbientTransitionState,
  nextLayer: AmbientLayer,
  reduceMotion: boolean
): AmbientTransitionState {
  if (state.current.key === nextLayer.key) {
    if (reduceMotion && state.previous) {
      return {
        current: state.current,
        previous: null,
        generation: state.generation + 1,
      };
    }
    return state;
  }

  return {
    current: nextLayer,
    previous:
      reduceMotion ||
      (state.current.kind === "empty" && state.previous === null)
        ? null
        : state.current,
    generation: state.generation + 1,
  };
}

export function completeAmbientTransition(
  state: AmbientTransitionState,
  generation: number
): AmbientTransitionState {
  if (state.generation !== generation || !state.previous) return state;
  return { ...state, previous: null };
}

export function selectAmbientBlobsToRelease(
  acquiredBlobs: Iterable<Blob>,
  state: AmbientTransitionState | null
): Blob[] {
  const acquired = new Set(acquiredBlobs);
  if (!state) return [...acquired];

  const retained = new Set(
    [state.current.blob, state.previous?.blob].filter(
      (blob): blob is Blob => blob !== null && blob !== undefined
    )
  );
  return [...acquired].filter((blob) => !retained.has(blob));
}

export function acquireAmbientBlobUrl(
  blob: Blob,
  acquiredUrls: Map<Blob, string>
): string {
  const existingUrl = acquiredUrls.get(blob);
  if (existingUrl) return existingUrl;

  const imageUrl = acquireBlobUrl(blob);
  acquiredUrls.set(blob, imageUrl);
  return imageUrl;
}

export function releaseAmbientBlobUrls(
  blobs: Iterable<Blob>,
  acquiredUrls: Map<Blob, string>
): void {
  for (const blob of new Set(blobs)) {
    if (!acquiredUrls.has(blob)) continue;
    releaseBlobUrl(blob);
    acquiredUrls.delete(blob);
  }
}
