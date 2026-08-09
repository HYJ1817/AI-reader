import { BOOK_METADATA_LIMITS, type BookIdentifier } from "./bookMetadata";

export type BookMetadataSearchInput = {
  title: string;
  authors?: string[];
  identifiers?: BookIdentifier[];
  language?: string;
  format: "epub" | "txt";
  needsCover: boolean;
};

export type NormalizedBookQuery = BookMetadataSearchInput & {
  normalizedTitle: string;
  normalizedAuthors: string[];
  normalizedIsbns: string[];
};

export type NormalizedBookCandidate = {
  source: "open-library" | "google-books";
  sourceId: string;
  title: string;
  authors: string[];
  description?: string;
  subjects: string[];
  publisher?: string;
  publishedDate?: string;
  language?: string;
  identifiers: BookIdentifier[];
  coverRef?: { source: "open-library" | "google-books"; id: string };
};

export type BookCandidateSelection = {
  candidate: NormalizedBookCandidate | null;
  score: number;
};

type UnknownRecord = Record<string, unknown>;

const ACCEPTANCE_THRESHOLD = 0.72;

function asRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function text(value: unknown, limit: number): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const normalized = String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, limit).trim() : undefined;
}

function texts(value: unknown, count: number, limit: number): string[] {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of values) {
    const normalized = text(item, limit);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= count) break;
  }
  return result;
}

function normalizeComparable(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, "");
}

function normalizedIsbn(value: string): string | undefined {
  const compact = value.normalize("NFKC").replace(/[^\dXx]/g, "").toUpperCase();
  return /^(?:\d{9}[\dX]|\d{13})$/.test(compact) ? compact : undefined;
}

function normalizeIdentifiers(value: unknown): BookIdentifier[] {
  if (!Array.isArray(value)) return [];
  const result: BookIdentifier[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    const item = asRecord(raw);
    const type = text(item?.type, BOOK_METADATA_LIMITS.identifierType)?.toUpperCase();
    const identifier = text(
      item?.value ?? item?.identifier,
      BOOK_METADATA_LIMITS.identifierValue
    );
    if (!type || !identifier) continue;
    const normalizedType = type.replace("ISBN_", "ISBN-");
    const key = `${normalizedType}\u0000${identifier}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ type: normalizedType, value: identifier });
    if (result.length >= BOOK_METADATA_LIMITS.identifiers) break;
  }
  return result;
}

function openLibraryIdentifiers(record: UnknownRecord): BookIdentifier[] {
  return texts(record.isbn, BOOK_METADATA_LIMITS.identifiers, BOOK_METADATA_LIMITS.identifierValue)
    .map((value) => ({ type: "ISBN", value }));
}

export function normalizeBookQuery(input: BookMetadataSearchInput): NormalizedBookQuery {
  const title = text(input.title, BOOK_METADATA_LIMITS.title) ?? "";
  const authors = texts(
    input.authors,
    BOOK_METADATA_LIMITS.authorCount,
    BOOK_METADATA_LIMITS.author
  );
  const identifiers = normalizeIdentifiers(input.identifiers);
  return {
    title,
    ...(authors.length > 0 ? { authors } : {}),
    ...(identifiers.length > 0 ? { identifiers } : {}),
    ...(text(input.language, BOOK_METADATA_LIMITS.language)
      ? { language: text(input.language, BOOK_METADATA_LIMITS.language) }
      : {}),
    format: input.format,
    needsCover: Boolean(input.needsCover),
    normalizedTitle: normalizeComparable(title),
    normalizedAuthors: authors.map(normalizeComparable).filter(Boolean),
    normalizedIsbns: identifiers
      .filter(({ type }) => /isbn/i.test(type))
      .map(({ value }) => normalizedIsbn(value))
      .filter((value): value is string => Boolean(value)),
  };
}

export function buildOpenLibraryQuery(query: NormalizedBookQuery): Record<string, string> {
  return {
    title: query.title,
    ...(query.authors?.[0] ? { author: query.authors[0] } : {}),
    ...(query.normalizedIsbns[0] ? { isbn: query.normalizedIsbns[0] } : {}),
  };
}

export function buildGoogleBooksQuery(query: NormalizedBookQuery): string {
  return [
    query.title ? `intitle:${query.title}` : "",
    query.authors?.[0] ? `inauthor:${query.authors[0]}` : "",
    query.normalizedIsbns[0] ? `isbn:${query.normalizedIsbns[0]}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function normalizeOpenLibraryWork(value: unknown): NormalizedBookCandidate | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const title = text(record.title, BOOK_METADATA_LIMITS.title);
  const key = text(record.key, 200);
  if (!title || !key) return undefined;
  const sourceId = key.split("/").filter(Boolean).at(-1);
  if (!sourceId) return undefined;
  const coverId = text(record.cover_i, 80);
  const descriptionRecord = asRecord(record.description);
  const description = text(
    typeof record.description === "string" ? record.description : descriptionRecord?.value,
    BOOK_METADATA_LIMITS.description
  );
  const publisher = texts(record.publisher, 1, BOOK_METADATA_LIMITS.publisher)[0];
  const publishedDate = text(
    record.first_publish_year ?? record.publish_date,
    BOOK_METADATA_LIMITS.publishedDate
  );
  const language = texts(record.language, 1, BOOK_METADATA_LIMITS.language)[0];
  return {
    source: "open-library",
    sourceId,
    title,
    authors: texts(record.author_name, BOOK_METADATA_LIMITS.authorCount, BOOK_METADATA_LIMITS.author),
    ...(description ? { description } : {}),
    subjects: texts(
      record.subject,
      BOOK_METADATA_LIMITS.subjectCount,
      BOOK_METADATA_LIMITS.subject
    ),
    ...(publisher ? { publisher } : {}),
    ...(publishedDate ? { publishedDate } : {}),
    ...(language ? { language } : {}),
    identifiers: openLibraryIdentifiers(record),
    ...(coverId ? { coverRef: { source: "open-library", id: coverId } } : {}),
  };
}

export function normalizeGoogleVolume(value: unknown): NormalizedBookCandidate | undefined {
  const record = asRecord(value);
  const info = asRecord(record?.volumeInfo);
  const sourceId = text(record?.id, 200);
  const title = text(info?.title, BOOK_METADATA_LIMITS.title);
  if (!sourceId || !title || !info) return undefined;
  const description = text(info.description, BOOK_METADATA_LIMITS.description);
  const publisher = text(info.publisher, BOOK_METADATA_LIMITS.publisher);
  const publishedDate = text(info.publishedDate, BOOK_METADATA_LIMITS.publishedDate);
  const language = text(info.language, BOOK_METADATA_LIMITS.language);
  const imageLinks = asRecord(info.imageLinks);
  const hasCover = Boolean(text(imageLinks?.thumbnail ?? imageLinks?.smallThumbnail, 2_000));
  return {
    source: "google-books",
    sourceId,
    title,
    authors: texts(info.authors, BOOK_METADATA_LIMITS.authorCount, BOOK_METADATA_LIMITS.author),
    ...(description ? { description } : {}),
    subjects: texts(
      info.categories,
      BOOK_METADATA_LIMITS.subjectCount,
      BOOK_METADATA_LIMITS.subject
    ),
    ...(publisher ? { publisher } : {}),
    ...(publishedDate ? { publishedDate } : {}),
    ...(language ? { language } : {}),
    identifiers: normalizeIdentifiers(info.industryIdentifiers),
    ...(hasCover ? { coverRef: { source: "google-books", id: sourceId } } : {}),
  };
}

function titleSimilarity(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) {
    return Math.min(left.length, right.length) / Math.max(left.length, right.length);
  }
  const leftPairs = new Set<string>();
  const rightPairs = new Set<string>();
  for (let index = 0; index < left.length - 1; index += 1) leftPairs.add(left.slice(index, index + 2));
  for (let index = 0; index < right.length - 1; index += 1) rightPairs.add(right.slice(index, index + 2));
  if (leftPairs.size === 0 || rightPairs.size === 0) return 0;
  let overlap = 0;
  for (const pair of leftPairs) if (rightPairs.has(pair)) overlap += 1;
  return (2 * overlap) / (leftPairs.size + rightPairs.size);
}

function candidateIsbns(candidate: NormalizedBookCandidate): string[] {
  return candidate.identifiers
    .filter(({ type }) => /isbn/i.test(type))
    .map(({ value }) => normalizedIsbn(value))
    .filter((value): value is string => Boolean(value));
}

function authorSimilarity(query: NormalizedBookQuery, candidate: NormalizedBookCandidate): number {
  if (query.normalizedAuthors.length === 0) return 0;
  const candidateAuthors = candidate.authors.map(normalizeComparable).filter(Boolean);
  if (candidateAuthors.length === 0) return 0;
  let matches = 0;
  for (const author of query.normalizedAuthors) {
    if (
      candidateAuthors.some(
        (candidateAuthor) =>
          candidateAuthor === author ||
          candidateAuthor.includes(author) ||
          author.includes(candidateAuthor)
      )
    ) matches += 1;
  }
  return matches / Math.max(query.normalizedAuthors.length, candidateAuthors.length);
}

function scoreCandidate(query: NormalizedBookQuery, candidate: NormalizedBookCandidate) {
  const titleScore = titleSimilarity(query.normalizedTitle, normalizeComparable(candidate.title));
  const isbnScore = query.normalizedIsbns.some((isbn) => candidateIsbns(candidate).includes(isbn));
  const authorScore = authorSimilarity(query, candidate);
  const languageScore =
    query.language && candidate.language
      ? normalizeComparable(query.language).slice(0, 2) ===
        normalizeComparable(candidate.language).slice(0, 2)
        ? 1
        : 0
      : 0;

  // ISBN is authoritative. Without it, a material title conflict cannot be rescued by author/language.
  if (!isbnScore && titleScore < 0.45) {
    return { score: Math.min(0.4, titleScore * 0.6 + authorScore * 0.2), authorScore };
  }
  const score = isbnScore
    ? 0.78 + titleScore * 0.1 + authorScore * 0.08 + languageScore * 0.04
    : titleScore * 0.72 + authorScore * 0.23 + languageScore * 0.05;
  return { score: Math.min(1, score), authorScore };
}

export function selectBestBookCandidate(
  query: NormalizedBookQuery,
  candidates: NormalizedBookCandidate[]
): BookCandidateSelection {
  const ranked = candidates.map((candidate) => ({
    candidate,
    ...scoreCandidate(query, candidate),
  }));
  ranked.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (right.candidate.identifiers.length !== left.candidate.identifiers.length) {
      return right.candidate.identifiers.length - left.candidate.identifiers.length;
    }
    if (right.authorScore !== left.authorScore) return right.authorScore - left.authorScore;
    if (Boolean(right.candidate.description) !== Boolean(left.candidate.description)) {
      return Number(Boolean(right.candidate.description)) - Number(Boolean(left.candidate.description));
    }
    return `${left.candidate.source}:${left.candidate.sourceId}`.localeCompare(
      `${right.candidate.source}:${right.candidate.sourceId}`
    );
  });
  const best = ranked[0];
  if (!best || best.score < ACCEPTANCE_THRESHOLD) {
    return { candidate: null, score: best?.score ?? 0 };
  }
  return { candidate: best.candidate, score: best.score };
}
