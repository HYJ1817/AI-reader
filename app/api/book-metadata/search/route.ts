import { AiRequestError, readLimitedJson } from "../../../../lib/aiRequestSecurity";
import { BOOK_METADATA_LIMITS } from "../../../../lib/bookMetadata";
import { searchPublicBookMetadata } from "../../../../lib/bookMetadataSearch";
import type { BookMetadataSearchInput } from "../../../../lib/bookMetadataProviders";

const REQUEST_LIMIT = 64_000;

function isStringArray(value: unknown, maxCount: number, maxLength: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxCount &&
    value.every((item) => typeof item === "string" && item.length <= maxLength)
  );
}

function parseInput(body: unknown): BookMetadataSearchInput | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const value = body as Record<string, unknown>;
  if (
    typeof value.title !== "string" ||
    !value.title.trim() ||
    value.title.length > BOOK_METADATA_LIMITS.title ||
    (value.format !== "epub" && value.format !== "txt") ||
    typeof value.needsCover !== "boolean" ||
    (value.authors !== undefined &&
      !isStringArray(value.authors, BOOK_METADATA_LIMITS.authorCount, BOOK_METADATA_LIMITS.author)) ||
    (value.language !== undefined &&
      (typeof value.language !== "string" || value.language.length > BOOK_METADATA_LIMITS.language)) ||
    (value.identifiers !== undefined &&
      (!Array.isArray(value.identifiers) ||
        value.identifiers.length > BOOK_METADATA_LIMITS.identifiers ||
        value.identifiers.some((identifier) => {
          if (!identifier || typeof identifier !== "object" || Array.isArray(identifier)) return true;
          const item = identifier as Record<string, unknown>;
          return (
            typeof item.type !== "string" ||
            item.type.length > BOOK_METADATA_LIMITS.identifierType ||
            typeof item.value !== "string" ||
            item.value.length > BOOK_METADATA_LIMITS.identifierValue
          );
        })))
  ) return undefined;

  return {
    title: value.title,
    ...(value.authors !== undefined ? { authors: value.authors as string[] } : {}),
    ...(value.identifiers !== undefined
      ? { identifiers: value.identifiers as BookMetadataSearchInput["identifiers"] }
      : {}),
    ...(value.language !== undefined ? { language: value.language as string } : {}),
    format: value.format,
    needsCover: value.needsCover,
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await readLimitedJson(request, REQUEST_LIMIT);
  } catch (error) {
    const status = error instanceof AiRequestError ? error.status : 400;
    return Response.json(
      { error: status === 413 ? "Request body too large" : "Invalid JSON body" },
      { status }
    );
  }
  const input = parseInput(body);
  if (!input) {
    return Response.json({ error: "Invalid book metadata query" }, { status: 400 });
  }
  try {
    const result = await searchPublicBookMetadata(input, {
      fetcher: fetch,
      googleBooksApiKey: process.env.GOOGLE_BOOKS_API_KEY ?? "",
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Book metadata search failed" }, { status: 502 });
  }
}
