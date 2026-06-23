"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { acquireBlobUrl, releaseBlobUrl } from "../lib/blobUrlCache";
import { createFallbackCoverStyle } from "../lib/bookCoverStyle";
import type { BookRecord } from "../lib/db";
import styles from "./page.module.css";

const AMBIENT_CROSSFADE_MS = 340;

export type AmbientLayer = {
  key: string;
  kind: "empty" | "fallback" | "image";
  imageUrl: string | null;
  paper: string | null;
  spine: string | null;
  blob: Blob | null;
};

export type AmbientLayerState = {
  current: AmbientLayer;
  previous: AmbientLayer | null;
};

type AmbientBookBackgroundProps = {
  book: BookRecord | null;
  reduceMotion: boolean;
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

export function transitionAmbientLayers(
  state: AmbientLayerState,
  nextLayer: AmbientLayer,
  reduceMotion: boolean
): AmbientLayerState {
  if (state.current.key === nextLayer.key) {
    if (reduceMotion && state.previous) {
      return { current: state.current, previous: null };
    }
    return state;
  }

  if (
    reduceMotion ||
    (state.current.kind === "empty" && state.previous === null)
  ) {
    return { current: nextLayer, previous: null };
  }

  return { current: nextLayer, previous: state.current };
}

export function findRetiredAmbientBlobs(
  previousState: AmbientLayerState,
  nextState: AmbientLayerState
): Blob[] {
  const isBlob = (blob: Blob | null | undefined): blob is Blob =>
    blob !== null && blob !== undefined;
  const retained = new Set(
    [nextState.current.blob, nextState.previous?.blob].filter(isBlob)
  );
  const retired = new Set(
    [previousState.current.blob, previousState.previous?.blob]
      .filter(isBlob)
      .filter((blob) => !retained.has(blob))
  );

  return [...retired];
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

function layerStyle(layer: AmbientLayer): CSSProperties {
  return {
    ...(layer.imageUrl
      ? { backgroundImage: `url(${layer.imageUrl})` }
      : {}),
    "--ambient-cover-paper": layer.paper ?? undefined,
    "--ambient-cover-spine": layer.spine ?? undefined,
  } as CSSProperties;
}

export default function AmbientBookBackground({
  book,
  reduceMotion,
}: AmbientBookBackgroundProps) {
  const initialState: AmbientLayerState = {
    current: createAmbientLayer(null, null),
    previous: null,
  };
  const [layers, setLayers] = useState(initialState);
  const layersRef = useRef(initialState);
  const acquiredUrlsRef = useRef(new Map<Blob, string>());
  const retiredBlobsRef = useRef(new Set<Blob>());

  const commitLayers = useCallback((nextState: AmbientLayerState) => {
    const previousState = layersRef.current;
    if (previousState === nextState) return;

    for (const blob of findRetiredAmbientBlobs(previousState, nextState)) {
      retiredBlobsRef.current.add(blob);
    }
    layersRef.current = nextState;
    setLayers(nextState);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const coverBlob = book?.coverImageBlob ?? null;
      let imageUrl: string | null = null;

      if (coverBlob) {
        imageUrl = acquireAmbientBlobUrl(
          coverBlob,
          acquiredUrlsRef.current
        );
      }

      const nextLayer = createAmbientLayer(book, imageUrl);
      commitLayers(
        transitionAmbientLayers(layersRef.current, nextLayer, reduceMotion)
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [book, commitLayers, reduceMotion]);

  useEffect(() => {
    releaseAmbientBlobUrls(
      retiredBlobsRef.current,
      acquiredUrlsRef.current
    );
    retiredBlobsRef.current.clear();
  }, [layers]);

  useEffect(() => {
    if (!layers.previous || reduceMotion) return;

    const timeout = window.setTimeout(() => {
      const latest = layersRef.current;
      if (!latest.previous) return;
      commitLayers({ current: latest.current, previous: null });
    }, AMBIENT_CROSSFADE_MS);

    return () => window.clearTimeout(timeout);
  }, [commitLayers, layers.previous, reduceMotion]);

  useEffect(
    () => () => {
      releaseAmbientBlobUrls(
        acquiredUrlsRef.current.keys(),
        acquiredUrlsRef.current
      );
      retiredBlobsRef.current.clear();
    },
    []
  );

  return (
    <div
      className={styles.ambientBookBackground}
      aria-hidden="true"
      data-reduce-motion={reduceMotion ? "true" : "false"}
    >
      {layers.previous ? (
        <span
          key={layers.previous.key}
          className={styles.ambientBookLayer}
          data-kind={layers.previous.kind}
          data-layer="previous"
          style={layerStyle(layers.previous)}
        />
      ) : null}
      <span
        key={layers.current.key}
        className={styles.ambientBookLayer}
        data-kind={layers.current.kind}
        data-layer="current"
        style={layerStyle(layers.current)}
      />
    </div>
  );
}
