import type { AnnotationRecord, HighlightColor } from "./db";
import type { ReaderMode } from "./readerMode";
import type {
  ReaderLocationSnapshot,
  ReaderTextSelection,
} from "./readerAnnotations";
import {
  scrollLeftFromProgress,
  scrollTopFromProgress,
} from "./txtReader";

const TXT_LOCATOR_PREFIX = "txt:v1:";

export type TxtAnnotationLocator =
  | {
      version: 1;
      type: "point";
      paragraph: number;
      offset: number;
    }
  | {
      version: 1;
      type: "range";
      startParagraph: number;
      startOffset: number;
      endParagraph: number;
      endOffset: number;
    };

export type TxtHighlightRun = {
  text: string;
  annotationId?: string;
  color?: HighlightColor;
};

function isIndex(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

export function serializeTxtLocator(locator: TxtAnnotationLocator): string {
  return `${TXT_LOCATOR_PREFIX}${JSON.stringify(locator)}`;
}

export function parseTxtLocator(value: string): TxtAnnotationLocator | null {
  if (!value.startsWith(TXT_LOCATOR_PREFIX)) return null;
  try {
    const parsed = JSON.parse(value.slice(TXT_LOCATOR_PREFIX.length)) as Record<
      string,
      unknown
    >;
    if (parsed.version !== 1) return null;
    if (
      parsed.type === "point" &&
      isIndex(parsed.paragraph) &&
      isIndex(parsed.offset)
    ) {
      return {
        version: 1,
        type: "point",
        paragraph: parsed.paragraph,
        offset: parsed.offset,
      };
    }
    if (
      parsed.type === "range" &&
      isIndex(parsed.startParagraph) &&
      isIndex(parsed.startOffset) &&
      isIndex(parsed.endParagraph) &&
      isIndex(parsed.endOffset) &&
      (parsed.startParagraph < parsed.endParagraph ||
        (parsed.startParagraph === parsed.endParagraph &&
          parsed.startOffset < parsed.endOffset))
    ) {
      return {
        version: 1,
        type: "range",
        startParagraph: parsed.startParagraph,
        startOffset: parsed.startOffset,
        endParagraph: parsed.endParagraph,
        endOffset: parsed.endOffset,
      };
    }
  } catch {
    return null;
  }
  return null;
}

function paragraphForNode(node: Node | null, reader: HTMLElement): HTMLElement | null {
  const element =
    node?.nodeType === 1 ? (node as Element) : node?.parentElement ?? null;
  const paragraph = element?.closest<HTMLElement>("[data-paragraph-index]") ?? null;
  return paragraph && reader.contains(paragraph) ? paragraph : null;
}

function paragraphIndex(paragraph: HTMLElement): number | null {
  const value = Number(paragraph.dataset.paragraphIndex);
  return isIndex(value) ? value : null;
}

function textOffset(
  paragraph: HTMLElement,
  container: Node,
  offset: number
): number | null {
  try {
    const range = paragraph.ownerDocument.createRange();
    range.selectNodeContents(paragraph);
    range.setEnd(container, offset);
    return range.toString().length;
  } catch {
    return null;
  }
}

export function captureTxtSelection(
  selection: Selection | null,
  reader: HTMLElement | null,
  progressPercent: number,
  pageNumber?: number
): ReaderTextSelection | null {
  if (!selection || !reader || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  const text = selection.toString().trim().replace(/\s+/g, " ");
  if (!text) return null;
  const range = selection.getRangeAt(0);
  const startParagraph = paragraphForNode(range.startContainer, reader);
  const endParagraph = paragraphForNode(range.endContainer, reader);
  if (!startParagraph || !endParagraph) return null;
  const startParagraphIndex = paragraphIndex(startParagraph);
  const endParagraphIndex = paragraphIndex(endParagraph);
  const startOffset = textOffset(startParagraph, range.startContainer, range.startOffset);
  const endOffset = textOffset(endParagraph, range.endContainer, range.endOffset);
  if (
    startParagraphIndex === null ||
    endParagraphIndex === null ||
    startOffset === null ||
    endOffset === null
  ) {
    return null;
  }
  return {
    locator: serializeTxtLocator({
      version: 1,
      type: "range",
      startParagraph: startParagraphIndex,
      startOffset,
      endParagraph: endParagraphIndex,
      endOffset,
    }),
    text,
    progressPercent,
    ...(pageNumber ? { pageNumber } : {}),
  };
}

export function captureCurrentTxtLocation(
  reader: HTMLElement | null,
  mode: ReaderMode,
  progressPercent: number,
  pageNumber?: number
): ReaderLocationSnapshot | null {
  if (!reader) return null;
  const readerRect = reader.getBoundingClientRect();
  const paragraphs = Array.from(
    reader.querySelectorAll<HTMLElement>("[data-paragraph-index]")
  );
  const visible = paragraphs
    .map((paragraph) => {
      const rect = paragraph.getBoundingClientRect();
      const intersects =
        mode === "paged"
          ? rect.right >= readerRect.left && rect.left <= readerRect.right
          : rect.bottom >= readerRect.top && rect.top <= readerRect.bottom;
      const distance = Math.abs(
        mode === "paged" ? rect.left - readerRect.left : rect.top - readerRect.top
      );
      return { paragraph, intersects, distance };
    })
    .filter((candidate) => candidate.intersects)
    .sort((a, b) => a.distance - b.distance);
  const paragraph = visible[0]?.paragraph ?? paragraphs[0];
  if (!paragraph) return null;
  const index = paragraphIndex(paragraph);
  if (index === null) return null;
  return {
    locator: serializeTxtLocator({
      version: 1,
      type: "point",
      paragraph: index,
      offset: 0,
    }),
    text: (paragraph.textContent ?? "").trim().slice(0, 160),
    progressPercent,
    ...(pageNumber ? { pageNumber } : {}),
  };
}

export function buildTxtHighlightRuns(
  paragraph: number,
  text: string,
  highlights: AnnotationRecord[]
): TxtHighlightRun[] {
  const ranges = highlights.flatMap((record, priority) => {
    if (record.kind !== "highlight" || !record.locator) return [];
    const locator = parseTxtLocator(record.locator);
    if (!locator || locator.type !== "range") return [];
    if (paragraph < locator.startParagraph || paragraph > locator.endParagraph) {
      return [];
    }
    const start = paragraph === locator.startParagraph ? locator.startOffset : 0;
    const end = paragraph === locator.endParagraph ? locator.endOffset : text.length;
    const safeStart = Math.max(0, Math.min(text.length, start));
    const safeEnd = Math.max(safeStart, Math.min(text.length, end));
    return safeEnd > safeStart
      ? [{ start: safeStart, end: safeEnd, record, priority }]
      : [];
  });
  if (ranges.length === 0) return [{ text }];

  const boundaries = Array.from(
    new Set([0, text.length, ...ranges.flatMap((range) => [range.start, range.end])])
  ).sort((a, b) => a - b);
  const runs: TxtHighlightRun[] = [];
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    if (end <= start) continue;
    const active = ranges
      .filter((range) => range.start <= start && range.end >= end)
      .sort((a, b) => b.priority - a.priority)[0];
    const next: TxtHighlightRun = active
      ? {
          text: text.slice(start, end),
          annotationId: active.record.id,
          color: active.record.color ?? "yellow",
        }
      : { text: text.slice(start, end) };
    const previous = runs.at(-1);
    if (
      previous &&
      previous.annotationId === next.annotationId &&
      previous.color === next.color
    ) {
      previous.text += next.text;
    } else {
      runs.push(next);
    }
  }
  return runs;
}

export function navigateToTxtLocator(
  reader: HTMLElement,
  value: string,
  mode: ReaderMode,
  fallbackPercent: number,
  reduceMotion: boolean
): boolean {
  const locator = parseTxtLocator(value);
  const paragraphIndexValue =
    locator?.type === "point"
      ? locator.paragraph
      : locator?.type === "range"
        ? locator.startParagraph
        : null;
  const target =
    paragraphIndexValue === null
      ? null
      : reader.querySelector<HTMLElement>(
          `[data-paragraph-index="${paragraphIndexValue}"]`
        );
  const behavior: ScrollBehavior = reduceMotion ? "auto" : "smooth";
  if (target) {
    const readerRect = reader.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    if (mode === "paged") {
      reader.scrollTo({
        left: reader.scrollLeft + targetRect.left - readerRect.left,
        behavior,
      });
    } else {
      reader.scrollTo({
        top: reader.scrollTop + targetRect.top - readerRect.top,
        behavior,
      });
    }
    return true;
  }
  if (mode === "paged") {
    reader.scrollTo({
      left: scrollLeftFromProgress(
        fallbackPercent,
        reader.scrollWidth,
        reader.clientWidth
      ),
      behavior,
    });
  } else {
    reader.scrollTo({
      top: scrollTopFromProgress(
        fallbackPercent,
        reader.scrollHeight,
        reader.clientHeight
      ),
      behavior,
    });
  }
  return false;
}
