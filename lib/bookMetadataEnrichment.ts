import type { BookMetadata } from "./db";
import {
  markBookEnrichmentFailed,
  BOOK_METADATA_LIMITS,
  type BookEnrichmentError,
  mergeBookEnrichment,
  type BookEnrichment,
  type BookMetadataProvenance,
} from "./bookMetadata";
import type {
  PublicBookMetadataSearchResult,
} from "./bookMetadataSearch";
import type {
  BookMetadataSearchInput,
  NormalizedBookCandidate,
} from "./bookMetadataProviders";
import type { MetadataAiCompletion, MetadataAiField } from "./bookMetadataAi";

export type BookMetadataEnrichmentMode = "automatic" | "manual";

export type MetadataAiCompletionRequest = {
  provider: unknown;
  knownMetadata: Record<string, unknown>;
  missing: MetadataAiField[];
  excerpt: string;
};

export type MetadataAiCompletionResponse = {
  completion: MetadataAiCompletion;
  provenance: BookMetadataProvenance;
};

export type BookMetadataEnrichmentDependencies = {
  now: () => string;
  searchPublic: (
    input: BookMetadataSearchInput,
    signal: AbortSignal
  ) => Promise<PublicBookMetadataSearchResult>;
  downloadCover: (
    coverRef: NonNullable<NormalizedBookCandidate["coverRef"]>,
    signal: AbortSignal
  ) => Promise<Blob | undefined>;
  getBookFile: (bookId: string) => Promise<Blob | undefined>;
  extractOpeningExcerpt: (
    blob: Blob,
    format: "epub" | "txt"
  ) => Promise<string>;
  completeWithAi: (
    request: MetadataAiCompletionRequest,
    signal: AbortSignal
  ) => Promise<MetadataAiCompletionResponse>;
  updateBookEnrichment: (
    bookId: string,
    enrichment: BookEnrichment,
    coverImageBlob?: Blob
  ) => Promise<void>;
  aiProvider?: unknown;
  aiUsable: boolean;
  isAiAuthorized?: () => boolean;
  singleBookAiConsent?: boolean;
  shouldCommit?: () => boolean;
  signal?: AbortSignal;
};

export type BookEnrichmentResult = {
  enrichment: BookEnrichment;
  committed: boolean;
  coverUpdated: boolean;
  offerAiCompletion?: boolean;
};

export function metadataErrorCode(error: unknown): BookEnrichmentError {
  if (error && typeof error === "object") {
    const { code, name } = error as { code?: unknown; name?: unknown };
    if (["offline", "timeout", "provider", "invalid-response", "no-match"].includes(String(code))) {
      return code as BookEnrichmentError;
    }
    if (name === "TimeoutError") return "timeout";
    if (error instanceof TypeError) return "offline";
  }
  return "provider";
}

function candidatePatch(candidate: NormalizedBookCandidate, attemptedAt: string) {
  return {
    bibliographicTitle: candidate.title,
    authors: candidate.authors,
    description: candidate.description,
    subjects: candidate.subjects,
    publisher: candidate.publisher,
    publishedDate: candidate.publishedDate,
    language: candidate.language,
    identifiers: candidate.identifiers,
    source: {
      source: candidate.source,
      sourceId: candidate.sourceId,
    } as BookMetadataProvenance,
    attemptedAt,
  };
}

function queryForBook(book: BookMetadata): BookMetadataSearchInput {
  return {
    title: book.enrichment?.bibliographicTitle ?? book.title,
    ...(book.enrichment?.authors ? { authors: book.enrichment.authors } : {}),
    ...(book.enrichment?.identifiers
      ? { identifiers: book.enrichment.identifiers }
      : {}),
    ...(book.enrichment?.language ? { language: book.enrichment.language } : {}),
    format: book.format,
    needsCover: !book.coverImageBlob,
  };
}

function knownMetadata(book: BookMetadata, enrichment: BookEnrichment) {
  return {
    title: enrichment.bibliographicTitle ?? book.title,
    authors: enrichment.authors,
    publisher: enrichment.publisher,
    publishedDate: enrichment.publishedDate,
    language: enrichment.language,
  };
}

function missingProse(enrichment: BookEnrichment): MetadataAiField[] {
  const missing: MetadataAiField[] = [];
  if (!enrichment.description) missing.push("description");
  if (!enrichment.subjects?.length) missing.push("subjects");
  return missing;
}

export async function enrichBookMetadata(
  book: BookMetadata,
  mode: BookMetadataEnrichmentMode,
  deps: BookMetadataEnrichmentDependencies
): Promise<BookEnrichmentResult> {
  const attemptedAt = deps.now();
  const signal = deps.signal ?? new AbortController().signal;
  const shouldCommit = deps.shouldCommit ?? (() => true);
  const singleBookConsent = mode === "manual" && deps.singleBookAiConsent === true;
  // Opting in later must not replay work started without permission.
  const authorizedAtStart = singleBookConsent || deps.isAiAuthorized?.() === true;
  const maySendAi = () => authorizedAtStart && !signal.aborted && shouldCommit() &&
    (singleBookConsent || deps.isAiAuthorized?.() === true);
  let enrichment: BookEnrichment = {
    ...(book.enrichment ?? {}),
    status: "pending",
    attemptedAt,
  };

  if (!shouldCommit()) {
    return { enrichment, committed: false, coverUpdated: false };
  }
  await deps.updateBookEnrichment(book.id, enrichment);

  let publicResult: PublicBookMetadataSearchResult;
  try {
    publicResult = await deps.searchPublic(queryForBook(book), signal);
  } catch (error) {
    enrichment = markBookEnrichmentFailed(enrichment, metadataErrorCode(error), attemptedAt);
    if (!shouldCommit()) {
      return { enrichment, committed: false, coverUpdated: false };
    }
    await deps.updateBookEnrichment(book.id, enrichment);
    return { enrichment, committed: true, coverUpdated: false };
  }

  const candidate = publicResult.candidate;
  if (candidate) {
    enrichment = mergeBookEnrichment(
      enrichment,
      { ...candidatePatch(candidate, attemptedAt), matchScore: publicResult.score },
      mode
    );
  }

  let coverImageBlob: Blob | undefined;
  const coverMayBeReplaced =
    !book.coverImageBlob ||
    (mode === "manual" && Boolean(book.enrichment?.fieldSources?.cover));
  if (candidate?.coverRef && coverMayBeReplaced) {
    try {
      coverImageBlob = await deps.downloadCover(candidate.coverRef, signal);
      if (coverImageBlob) {
        enrichment = {
          ...enrichment,
          fieldSources: {
            ...(enrichment.fieldSources ?? {}),
            cover: { source: candidate.source, sourceId: candidate.sourceId },
          },
        };
      }
    } catch {
      // A cover failure must not discard usable bibliographic metadata.
    }
  }

  const missing = missingProse(enrichment);
  let aiCompleted = false;
  if (missing.length > 0 && deps.aiUsable && deps.aiProvider && maySendAi()) {
    try {
      const sourceBlob = await deps.getBookFile(book.id);
      if (sourceBlob) {
        const excerpt = await deps.extractOpeningExcerpt(sourceBlob, book.format);
        if (maySendAi()) {
        const aiResult = await deps.completeWithAi(
          {
            provider: deps.aiProvider,
            knownMetadata: knownMetadata(book, enrichment),
            missing,
            excerpt: excerpt.slice(0, BOOK_METADATA_LIMITS.excerpt),
          },
          signal
        );
        enrichment = mergeBookEnrichment(
          enrichment,
          {
            ...aiResult.completion,
            source: aiResult.provenance,
            attemptedAt,
          },
          "automatic"
        );
        aiCompleted = Object.keys(aiResult.completion).length > 0;
        }
      }
    } catch (error) {
      enrichment = markBookEnrichmentFailed(enrichment, metadataErrorCode(error), attemptedAt);
    }
  }

  if (!candidate && !aiCompleted && enrichment.status !== "failed") {
    enrichment = markBookEnrichmentFailed(
      enrichment,
      publicResult.errorCode ?? "no-match",
      attemptedAt
    );
  }
  if (!shouldCommit()) {
    return {
      enrichment,
      committed: false,
      coverUpdated: Boolean(coverImageBlob),
    };
  }
  await deps.updateBookEnrichment(book.id, enrichment, coverImageBlob);
  return {
    enrichment,
    committed: true,
    coverUpdated: Boolean(coverImageBlob),
    offerAiCompletion: mode === "manual" && missingProse(enrichment).length > 0 &&
      !singleBookConsent && deps.isAiAuthorized?.() !== true,
  };
}
