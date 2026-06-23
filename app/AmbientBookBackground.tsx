"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  AMBIENT_CROSSFADE_MS,
  acquireAmbientBlobUrl,
  completeAmbientTransition,
  createAmbientLayer,
  createInitialAmbientTransitionState,
  releaseAmbientBlobUrls,
  selectAmbientBlobsToRelease,
  startAmbientTransition,
  type AmbientLayer,
  type AmbientTransitionState,
} from "@/lib/ambientBookBackground";
import type { BookRecord } from "@/lib/db";
import styles from "./page.module.css";

type AmbientBookBackgroundProps = {
  book: BookRecord | null;
  reduceMotion: boolean;
};

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
  const [layers, setLayers] = useState(createInitialAmbientTransitionState);
  const layersRef = useRef(layers);
  const acquiredUrlsRef = useRef(new Map<Blob, string>());

  const commitLayers = useCallback((nextState: AmbientTransitionState) => {
    if (layersRef.current === nextState) return;
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
        startAmbientTransition(layersRef.current, nextLayer, reduceMotion)
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [book, commitLayers, reduceMotion]);

  useEffect(() => {
    releaseAmbientBlobUrls(
      selectAmbientBlobsToRelease(
        acquiredUrlsRef.current.keys(),
        layersRef.current
      ),
      acquiredUrlsRef.current
    );
  }, [layers]);

  useEffect(() => {
    if (!layers.previous || reduceMotion) return;

    const generation = layers.generation;
    const timeout = window.setTimeout(() => {
      commitLayers(
        completeAmbientTransition(layersRef.current, generation)
      );
    }, AMBIENT_CROSSFADE_MS);

    return () => window.clearTimeout(timeout);
  }, [
    commitLayers,
    layers.generation,
    layers.previous,
    reduceMotion,
  ]);

  useEffect(
    () => () => {
      releaseAmbientBlobUrls(
        selectAmbientBlobsToRelease(acquiredUrlsRef.current.keys(), null),
        acquiredUrlsRef.current
      );
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
