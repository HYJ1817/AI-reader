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
  completeAmbientTransition,
  createAmbientBlobUrlRegistry,
  createAmbientLayer,
  createCustomAmbientLayer,
  createInitialAmbientTransitionState,
  startAmbientTransition,
  type AmbientBlobUrlRegistry,
  type AmbientLayer,
  type AmbientTransitionState,
} from "@/lib/ambientBookBackground";
import type { BookRecord } from "@/lib/db";
import styles from "./page.module.css";

type AmbientBookBackgroundProps = {
  book: BookRecord | null;
  customBackgroundBlob?: Blob | null;
  customBackgroundOpacity?: number;
  reduceMotion: boolean;
};

function isCustomLayer(layer: AmbientLayer): boolean {
  return layer.key.startsWith("ambient:custom:");
}

function clampCustomBackgroundEffect(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

function layerStyle(layer: AmbientLayer, customBackgroundOpacity: number): CSSProperties {
  const customEffect = clampCustomBackgroundEffect(customBackgroundOpacity);
  return {
    ...(layer.imageUrl
      ? { backgroundImage: `url(${layer.imageUrl})` }
      : {}),
    "--ambient-cover-paper": layer.paper ?? undefined,
    "--ambient-cover-spine": layer.spine ?? undefined,
    "--ambient-custom-blur": isCustomLayer(layer)
      ? `${Math.round(customEffect * 42)}px`
      : undefined,
    "--ambient-custom-inset": isCustomLayer(layer)
      ? `${Math.round(customEffect * -42)}px`
      : undefined,
  } as CSSProperties;
}

export default function AmbientBookBackground({
  book,
  customBackgroundBlob = null,
  customBackgroundOpacity = 1,
  reduceMotion,
}: AmbientBookBackgroundProps) {
  const [layers, setLayers] = useState(createInitialAmbientTransitionState);
  const layersRef = useRef(layers);
  const registryRef = useRef<AmbientBlobUrlRegistry | null>(null);
  const customEffect = clampCustomBackgroundEffect(customBackgroundOpacity);

  const commitLayers = useCallback((nextState: AmbientTransitionState) => {
    if (layersRef.current === nextState) return;
    layersRef.current = nextState;
    setLayers(nextState);
  }, []);

  const getRegistry = useCallback(() => {
    if (!registryRef.current) {
      registryRef.current = createAmbientBlobUrlRegistry();
    }
    return registryRef.current;
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const coverBlob = book?.coverImageBlob ?? null;
      let imageUrl: string | null = null;
      let nextLayer: AmbientLayer;

      if (customBackgroundBlob) {
        imageUrl = getRegistry().acquire(customBackgroundBlob);
        nextLayer = createCustomAmbientLayer(customBackgroundBlob, imageUrl);
      } else if (coverBlob) {
        imageUrl = getRegistry().acquire(coverBlob);
        nextLayer = createAmbientLayer(book, imageUrl);
      } else {
        nextLayer = createAmbientLayer(book, imageUrl);
      }

      commitLayers(
        startAmbientTransition(layersRef.current, nextLayer, reduceMotion)
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [book, commitLayers, customBackgroundBlob, getRegistry, reduceMotion]);

  useEffect(() => {
    registryRef.current?.releaseUnretained(layersRef.current);
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
      const registry = registryRef.current;
      registryRef.current = null;
      registry?.dispose();
    },
    []
  );

  return (
    <div
      className={styles.ambientBookBackground}
      aria-hidden="true"
      data-reduce-motion={reduceMotion ? "true" : "false"}
      data-custom-active={isCustomLayer(layers.current)}
      style={
        {
          "--ambient-custom-effect": customEffect,
        } as CSSProperties
      }
    >
      {layers.previous ? (
        <span
          key={layers.previous.key}
          className={styles.ambientBookLayer}
          data-kind={layers.previous.kind}
          data-layer="previous"
          data-custom={isCustomLayer(layers.previous)}
          style={layerStyle(layers.previous, customBackgroundOpacity)}
        />
      ) : null}
      <span
        key={layers.current.key}
        className={styles.ambientBookLayer}
        data-kind={layers.current.kind}
        data-layer="current"
        data-custom={isCustomLayer(layers.current)}
        style={layerStyle(layers.current, customBackgroundOpacity)}
      />
    </div>
  );
}
