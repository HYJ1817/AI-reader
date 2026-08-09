export const BOOK_METADATA_LIMITS = {
  title: 500,
  authorCount: 12,
  author: 200,
  description: 12_000,
  subjectCount: 16,
  subject: 80,
  identifiers: 12,
  identifierType: 40,
  identifierValue: 160,
  publisher: 300,
  publishedDate: 40,
  language: 40,
  excerpt: 6_000,
} as const;

export type BookMetadataSource = "open-library" | "google-books" | "ai";
export type BookEnrichmentStatus =
  | "pending"
  | "complete"
  | "partial"
  | "failed";
export type BookEnrichmentError =
  | "no-match"
  | "offline"
  | "timeout"
  | "provider"
  | "invalid-response";
export type BookMetadataField =
  | "bibliographicTitle"
  | "authors"
  | "description"
  | "subjects"
  | "publisher"
  | "publishedDate"
  | "language"
  | "identifiers"
  | "cover";

export type BookMetadataProvenance = {
  source: BookMetadataSource;
  sourceId?: string;
  generated?: boolean;
};

export type BookIdentifier = {
  type: string;
  value: string;
};

export type BookEnrichment = {
  bibliographicTitle?: string;
  authors?: string[];
  description?: string;
  subjects?: string[];
  publisher?: string;
  publishedDate?: string;
  language?: string;
  identifiers?: BookIdentifier[];
  status: BookEnrichmentStatus;
  matchScore?: number;
  attemptedAt: string;
  updatedAt?: string;
  errorCode?: BookEnrichmentError;
  fieldSources?: Partial<
    Record<BookMetadataField, BookMetadataProvenance>
  >;
};

export type EnrichmentCandidatePatch = Partial<
  Pick<
    BookEnrichment,
    | "bibliographicTitle"
    | "authors"
    | "description"
    | "subjects"
    | "publisher"
    | "publishedDate"
    | "language"
    | "identifiers"
  >
> & {
  source: BookMetadataProvenance;
  matchScore?: number;
  attemptedAt: string;
};

type EnrichmentMergeMode = "automatic" | "manual";

const ENRICHMENT_FIELDS = [
  "bibliographicTitle",
  "authors",
  "description",
  "subjects",
  "publisher",
  "publishedDate",
  "language",
  "identifiers",
] as const satisfies readonly Exclude<BookMetadataField, "cover">[];

function sanitizeText(
  value: unknown,
  maxLength: number,
  stripMarkup = false
): string | undefined {
  if (typeof value !== "string") return undefined;
  const withoutMarkup = stripMarkup ? value.replace(/<[^>]*>/g, " ") : value;
  const normalized = withoutMarkup.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  return normalized.slice(0, maxLength).trim();
}

function sanitizeStringList(
  value: unknown,
  itemLimit: number,
  itemLength: number
): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const sanitized = sanitizeText(item, itemLength, true);
    if (!sanitized || seen.has(sanitized)) continue;
    seen.add(sanitized);
    result.push(sanitized);
    if (result.length >= itemLimit) break;
  }
  return result.length > 0 ? result : undefined;
}

function sanitizeIdentifiers(value: unknown): BookIdentifier[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result: BookIdentifier[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const identifier = item as { type?: unknown; value?: unknown };
    const type = sanitizeText(
      identifier.type,
      BOOK_METADATA_LIMITS.identifierType
    )?.toUpperCase();
    const identifierValue = sanitizeText(
      identifier.value,
      BOOK_METADATA_LIMITS.identifierValue
    );
    if (!type || !identifierValue) continue;
    const key = `${type}\u0000${identifierValue}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ type, value: identifierValue });
    if (result.length >= BOOK_METADATA_LIMITS.identifiers) break;
  }
  return result.length > 0 ? result : undefined;
}

function sanitizeField(
  field: (typeof ENRICHMENT_FIELDS)[number],
  value: unknown
): string | string[] | BookIdentifier[] | undefined {
  switch (field) {
    case "bibliographicTitle":
      return sanitizeText(value, BOOK_METADATA_LIMITS.title, true);
    case "authors":
      return sanitizeStringList(
        value,
        BOOK_METADATA_LIMITS.authorCount,
        BOOK_METADATA_LIMITS.author
      );
    case "description":
      return sanitizeText(value, BOOK_METADATA_LIMITS.description, true);
    case "subjects":
      return sanitizeStringList(
        value,
        BOOK_METADATA_LIMITS.subjectCount,
        BOOK_METADATA_LIMITS.subject
      );
    case "publisher":
      return sanitizeText(value, BOOK_METADATA_LIMITS.publisher, true);
    case "publishedDate":
      return sanitizeText(value, BOOK_METADATA_LIMITS.publishedDate);
    case "language":
      return sanitizeText(value, BOOK_METADATA_LIMITS.language);
    case "identifiers":
      return sanitizeIdentifiers(value);
  }
}

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" ? value.trim().length > 0 : value != null;
}

function shouldReplaceField(
  existing: BookEnrichment | undefined,
  field: (typeof ENRICHMENT_FIELDS)[number],
  incoming: BookMetadataProvenance,
  mode: EnrichmentMergeMode
): boolean {
  const currentValue = existing?.[field];
  if (!hasValue(currentValue)) return true;
  if (mode === "automatic") return false;

  const currentSource = existing?.fieldSources?.[field];
  if (!currentSource) return false;
  if (incoming.source === "ai" && currentSource.source !== "ai") return false;
  return true;
}

function deriveStatus(enrichment: BookEnrichment): BookEnrichmentStatus {
  const hasDiscoveryMetadata =
    hasValue(enrichment.authors) || hasValue(enrichment.subjects);
  return hasValue(enrichment.description) && hasDiscoveryMetadata
    ? "complete"
    : "partial";
}

export function mergeBookEnrichment(
  existing: BookEnrichment | undefined,
  patch: EnrichmentCandidatePatch,
  mode: EnrichmentMergeMode
): BookEnrichment {
  const merged: BookEnrichment = {
    ...(existing ?? {}),
    status: "partial",
    attemptedAt: patch.attemptedAt,
  };
  const fieldSources = { ...(existing?.fieldSources ?? {}) };

  for (const field of ENRICHMENT_FIELDS) {
    const sanitized = sanitizeField(field, patch[field]);
    if (!hasValue(sanitized)) continue;
    if (!shouldReplaceField(existing, field, patch.source, mode)) continue;
    Object.assign(merged, { [field]: sanitized });
    fieldSources[field] = { ...patch.source };
  }

  if (Object.keys(fieldSources).length > 0) merged.fieldSources = fieldSources;
  if (Number.isFinite(patch.matchScore)) {
    merged.matchScore = Math.max(0, Math.min(1, patch.matchScore ?? 0));
  }
  merged.status = deriveStatus(merged);
  merged.updatedAt = patch.attemptedAt;
  delete merged.errorCode;
  return merged;
}

export function resolveBookEnrichmentStatus(
  enrichment:
    | Pick<BookEnrichment, "status" | "attemptedAt">
    | undefined,
  now = new Date()
): BookEnrichmentStatus | "idle" {
  if (!enrichment) return "idle";
  if (enrichment.status !== "pending") return enrichment.status;
  const attemptedAt = Date.parse(enrichment.attemptedAt);
  if (!Number.isFinite(attemptedAt)) return "failed";
  return now.getTime() - attemptedAt > 300_000 ? "failed" : "pending";
}

export function markBookEnrichmentFailed(
  previous: BookEnrichment | undefined,
  errorCode: BookEnrichmentError,
  attemptedAt: string
): BookEnrichment {
  return {
    ...(previous ?? {}),
    status: "failed",
    attemptedAt,
    errorCode,
  };
}
