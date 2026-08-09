# Book Details and Metadata Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a history-safe local book-details page and a non-blocking public-metadata enrichment pipeline with optional AI completion for descriptions and subjects.

**Architecture:** Keep the reader and library local-first: details read only `BookMetadata`, while source bytes remain lazy. A server-side public-provider layer normalizes and scores Open Library plus optional Google Books candidates; a separate guarded AI endpoint runs only for missing prose fields. A browser coordinator applies single-flight, provenance-aware writes to IndexedDB and feeds one new Push surface that reuses the current navigation, ambient background, cover transition, Dock, and reader-opening path.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Dexie 4, JSZip, Motion 12, Vitest 4, Playwright 1.61, OpenNext/Cloudflare.

---

## File map

### New domain and service files

- `lib/bookMetadata.ts` — enrichment types, normalization limits, merge policy, stale-state helpers.
- `lib/bookMetadata.test.ts` — merge, provenance, stale pending, input limits.
- `lib/epubPackage.ts` — one-pass EPUB OPF metadata/cover extraction and bounded opening excerpt extraction.
- `lib/epubPackage.test.ts` — namespaced OPF, cover, spine excerpt, malformed EPUB coverage.
- `lib/bookMetadataProviders.ts` — provider query construction, response normalization, candidate scoring and deterministic selection.
- `lib/bookMetadataProviders.test.ts` — Open Library/Google fixtures and multilingual matching.
- `lib/bookMetadataSearch.ts` — server-only provider orchestration with timeouts and partial success.
- `lib/bookMetadataSearch.test.ts` — fetch isolation, key/no-key behavior, no-match and provider failure.
- `lib/bookMetadataAi.ts` — bounded AI prompt, response-shape extraction and strict completion validation.
- `lib/bookMetadataAi.test.ts` — OpenAI/Anthropic/Gemini response fixtures and field allowlist.
- `lib/bookMetadataEnrichment.ts` — client orchestration and request/result contracts.
- `lib/bookMetadataEnrichment.test.ts` — public-first, AI-only-when-needed and single-flight token behavior.
- `lib/bookDetailsPresentation.ts` — pure labels and conditional section presentation.
- `lib/bookDetailsPresentation.test.ts` — CTA, status, metadata rows and TXT/EPUB variants.

### New routes and UI

- `app/api/book-metadata/search/route.ts` — bounded public search API.
- `app/api/book-metadata/search/route.test.ts` — request validation and safe error mapping.
- `app/api/book-metadata/cover/route.ts` — fixed-provider cover fetch, never an arbitrary proxy.
- `app/api/book-metadata/cover/route.test.ts` — ID, redirect, MIME and 2 MB enforcement.
- `app/api/book-metadata/complete/route.ts` — guarded structured AI completion.
- `app/api/book-metadata/complete/route.test.ts` — provider validation, allowed fields and secret-safe errors.
- `app/useBookMetadataEnrichment.ts` — per-book running-task registry and React refresh integration.
- `app/BookDetailsSurface.tsx` — local-first details Push surface and metadata popover.
- `lib/bookDetailsIntegration.test.ts` — source-level navigation, accessibility, lazy-loading and styling contracts.
- `e2e/book-details.spec.ts` — mobile navigation, mocked enrichment, failure and focus restoration.

### Existing files to modify

- `lib/db.ts`, `lib/db.test.ts` — optional enrichment storage and atomic metadata/cover update.
- `lib/backup.ts`, `lib/backup.test.ts` — bounded optional enrichment backup validation.
- `lib/epubCover.ts`, `lib/epubCover.test.ts` — retain the existing cover API through `epubPackage`.
- `lib/importBook.ts`, `lib/importBook.test.ts` — save extracted EPUB query hints and avoid a second unzip.
- `lib/appNavigation.ts`, `lib/appNavigation.test.ts` — add `book-details` Push entries.
- `lib/uiText.ts` — detail, status and retry copy.
- `app/AppPushSurfaces.tsx` — render `BookDetailsSurface`.
- `app/page.tsx` — route book presses to details, start enrichment, wire reader/TOC actions, choose detail ambient source, keep Dock visible.
- `app/MotionBookCover.tsx` — optional wrapper class/layout override needed by the nested detail transition source.
- `app/page.module.css` — detail layout, popover, stable update slots, themes and reduced motion.
- `docs/cloudflare-deploy.md` — optional `GOOGLE_BOOKS_API_KEY` deployment note.

## Task 1: Enrichment domain model and non-destructive merge

**Files:**
- Create: `lib/bookMetadata.ts`
- Create: `lib/bookMetadata.test.ts`

- [ ] **Step 1: Write failing domain tests**

Create tests that lock down the destructive boundaries before adding types:

```ts
import { describe, expect, it } from "vitest";
import {
  mergeBookEnrichment,
  resolveBookEnrichmentStatus,
  type BookEnrichment,
} from "./bookMetadata";

const existing: BookEnrichment = {
  description: "本地保留简介",
  status: "complete",
  attemptedAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("mergeBookEnrichment", () => {
  it("fills missing fields without replacing unprovenanced local values", () => {
    expect(
      mergeBookEnrichment(existing, {
        description: "远程简介",
        authors: ["卡尔·马克思"],
        source: { source: "open-library", sourceId: "OL123M" },
        matchScore: 0.91,
        attemptedAt: "2026-08-09T00:00:00.000Z",
      }, "automatic")
    ).toMatchObject({
      description: "本地保留简介",
      authors: ["卡尔·马克思"],
      fieldSources: {
        authors: { source: "open-library", sourceId: "OL123M" },
      },
    });
  });

  it("lets manual rescrape replace only previously scraped fields", () => {
    const scraped: BookEnrichment = {
      ...existing,
      description: "旧简介",
      fieldSources: {
        description: { source: "ai", generated: true },
      },
    };
    expect(
      mergeBookEnrichment(scraped, {
        description: "公开简介",
        source: { source: "google-books", sourceId: "volume-1" },
        matchScore: 0.95,
        attemptedAt: "2026-08-09T00:00:00.000Z",
      }, "manual").description
    ).toBe("公开简介");
  });
});

describe("resolveBookEnrichmentStatus", () => {
  it("treats a pending record older than five minutes as failed", () => {
    expect(resolveBookEnrichmentStatus({
      status: "pending",
      attemptedAt: "2026-08-09T00:00:00.000Z",
    }, new Date("2026-08-09T00:06:00.000Z"))).toBe("failed");
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the red state**

Run: `npm test -- lib/bookMetadata.test.ts`

Expected: FAIL because `./bookMetadata` does not exist.

- [ ] **Step 3: Implement bounded types and the merge function**

Create `lib/bookMetadata.ts` with these exported contracts and limits:

```ts
export const BOOK_METADATA_LIMITS = {
  title: 500,
  authorCount: 12,
  author: 200,
  description: 12_000,
  subjectCount: 16,
  subject: 80,
  identifiers: 12,
  excerpt: 6_000,
} as const;

export type BookMetadataSource = "open-library" | "google-books" | "ai";
export type BookEnrichmentStatus = "pending" | "complete" | "partial" | "failed";
export type BookEnrichmentError =
  | "no-match"
  | "offline"
  | "timeout"
  | "provider"
  | "invalid-response";
export type BookMetadataField =
  | "bibliographicTitle" | "authors" | "description" | "subjects"
  | "publisher" | "publishedDate" | "language" | "identifiers" | "cover";
export type BookMetadataProvenance = {
  source: BookMetadataSource;
  sourceId?: string;
  generated?: boolean;
};
export type BookEnrichment = {
  bibliographicTitle?: string;
  authors?: string[];
  description?: string;
  subjects?: string[];
  publisher?: string;
  publishedDate?: string;
  language?: string;
  identifiers?: Array<{ type: string; value: string }>;
  status: BookEnrichmentStatus;
  matchScore?: number;
  attemptedAt: string;
  updatedAt?: string;
  errorCode?: BookEnrichmentError;
  fieldSources?: Partial<Record<BookMetadataField, BookMetadataProvenance>>;
};
export type EnrichmentCandidatePatch = Partial<Pick<BookEnrichment,
  "bibliographicTitle" | "authors" | "description" | "subjects" |
  "publisher" | "publishedDate" | "language" | "identifiers"
>> & {
  source: BookMetadataProvenance;
  matchScore?: number;
  attemptedAt: string;
};

export function resolveBookEnrichmentStatus(
  enrichment: Pick<BookEnrichment, "status" | "attemptedAt"> | undefined,
  now = new Date()
): BookEnrichmentStatus | "idle" {
  if (!enrichment) return "idle";
  if (enrichment.status !== "pending") return enrichment.status;
  return now.getTime() - Date.parse(enrichment.attemptedAt) > 300_000
    ? "failed"
    : "pending";
}
```

Implement `mergeBookEnrichment(existing, patch, mode)` as a pure function. Sanitize every string and array using `BOOK_METADATA_LIMITS`; automatic mode fills only empty fields, manual mode may replace a field only when `existing.fieldSources[field]` exists. Set field provenance for every accepted patch field, preserve previous good values on failed attempts, and derive `complete` when description and at least one author/subject exist, otherwise `partial`.

- [ ] **Step 4: Run the domain tests**

Run: `npm test -- lib/bookMetadata.test.ts`

Expected: PASS for merge policy, limits, provenance and stale pending cases.

- [ ] **Step 5: Commit the domain boundary**

```bash
git add lib/bookMetadata.ts lib/bookMetadata.test.ts
git commit -m "feat: define book metadata enrichment model"
```

## Task 2: Persist enrichment and preserve it in backups

**Files:**
- Modify: `lib/db.ts`
- Modify: `lib/db.test.ts`
- Modify: `lib/backup.ts`
- Modify: `lib/backup.test.ts`

- [ ] **Step 1: Add failing database and backup tests**

Add `enrichment?: BookEnrichment` to the test fixture expectations and these cases:

```ts
it("updates enrichment without rewriting source bytes or reading data", async () => {
  await saveBook(makeBook({ id: "enriched", groupIds: ["g1"] }));
  await saveReadingPosition(makePosition({ bookId: "enriched", progressPercent: 42 }));
  await updateBookEnrichment("enriched", {
    status: "complete",
    authors: ["Author"],
    attemptedAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:01.000Z",
  });
  const book = await getBook("enriched");
  expect(book?.enrichment?.authors).toEqual(["Author"]);
  expect(book?.groupIds).toEqual(["g1"]);
  expect(await book?.fileBlob.text()).toBe("test");
  expect((await getReadingPosition("enriched"))?.progressPercent).toBe(42);
});

it("writes a scraped cover and enrichment provenance atomically", async () => {
  await saveBook(makeBook({ id: "remote-cover" }));
  await updateBookEnrichment("remote-cover", {
    status: "partial",
    attemptedAt: "2026-08-09T00:00:00.000Z",
    fieldSources: { cover: { source: "open-library", sourceId: "OL1M" } },
  }, new Blob(["image"], { type: "image/jpeg" }));
  expect(await (await getBook("remote-cover"))?.coverImageBlob?.text()).toBe("image");
});
```

In `backup.test.ts`, export a book with enrichment, validate that the v3 payload retains it, restore it, and assert the restored record has the same bounded fields. Add a malicious overlong description case and expect `validateBackupPayload` to reject it.

- [ ] **Step 2: Run the failing persistence tests**

Run: `npm test -- lib/db.test.ts lib/backup.test.ts`

Expected: FAIL because `BookMetadata.enrichment` and `updateBookEnrichment` are missing and backup validation drops the object.

- [ ] **Step 3: Implement the storage APIs**

In `lib/db.ts` import `BookEnrichment`, add `enrichment?: BookEnrichment` to `BookMetadata`, and export:

```ts
export async function updateBookEnrichment(
  bookId: string,
  enrichment: BookEnrichment,
  coverImageBlob?: Blob
): Promise<void> {
  const db = getDb();
  await db.transaction("rw", [db.books, db.bookCovers], async () => {
    const updated = await db.books.update(bookId, { enrichment });
    if (updated === 0) throw new Error(`Book not found: ${bookId}.`);
    if (coverImageBlob) {
      await db.bookCovers.put({
        bookId,
        coverImageData: await coverImageBlob.arrayBuffer(),
        coverImageType: coverImageBlob.type,
      });
    }
  });
}
```

Do not add a Dexie index or database version. In `backup.ts`, extend `BackupBookMeta` with optional `enrichment`, validate every nested string/array against `BOOK_METADATA_LIMITS`, preserve v1/v2/v3 reading, and keep output version 3.

- [ ] **Step 4: Run persistence and backup tests**

Run: `npm test -- lib/db.test.ts lib/backup.test.ts`

Expected: PASS; no test reads all source files to list metadata.

- [ ] **Step 5: Commit persistence compatibility**

```bash
git add lib/db.ts lib/db.test.ts lib/backup.ts lib/backup.test.ts
git commit -m "feat: persist enriched book metadata"
```

## Task 3: Extract EPUB query hints, cover and bounded opening text once

**Files:**
- Create: `lib/epubPackage.ts`
- Create: `lib/epubPackage.test.ts`
- Modify: `lib/epubCover.ts`
- Modify: `lib/epubCover.test.ts`
- Modify: `lib/importBook.ts`
- Modify: `lib/importBook.test.ts`

- [ ] **Step 1: Write failing package-extraction tests**

Use JSZip fixtures with namespaced OPF metadata and a two-item spine:

```ts
it("extracts package metadata, cover and opening spine text", async () => {
  const result = await extractEpubPackage(await makeEpubBlob({
    opf: `<package xmlns:dc="http://purl.org/dc/elements/1.1/">
      <metadata>
        <dc:title>资本论</dc:title><dc:creator>卡尔·马克思</dc:creator>
        <dc:identifier id="isbn">9787010000000</dc:identifier><dc:language>zh-CN</dc:language>
      </metadata>
      <manifest>
        <item id="cover" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/>
        <item id="c1" href="chapter-1.xhtml" media-type="application/xhtml+xml"/>
      </manifest><spine><itemref idref="c1"/></spine>
    </package>`,
    files: {
      "OPS/cover.jpg": "cover",
      "OPS/chapter-1.xhtml": "<html><body><h1>第一章</h1><p>商品的价值形式。</p></body></html>",
    },
  }), { includeExcerpt: true });
  expect(result.metadata).toEqual({
    title: "资本论", authors: ["卡尔·马克思"],
    identifiers: [{ type: "isbn", value: "9787010000000" }], language: "zh-CN",
  });
  expect(await result.coverImageBlob?.text()).toBe("cover");
  expect(result.excerpt).toContain("第一章 商品的价值形式");
});
```

Add cases for missing container, malformed XML, multiple creators, entity decoding, SVG/script/style removal, three-chapter/6,000-character truncation, and TXT excerpt truncation through `extractOpeningExcerpt(blob, "txt")`.

- [ ] **Step 2: Run package tests and confirm failure**

Run: `npm test -- lib/epubPackage.test.ts lib/importBook.test.ts lib/epubCover.test.ts`

Expected: FAIL because `extractEpubPackage` does not exist and import stores no query hints.

- [ ] **Step 3: Implement one-pass extraction and import wiring**

Create `extractEpubPackage(fileBlob, options)` returning:

```ts
export type EpubPackageExtraction = {
  metadata: {
    title?: string;
    authors?: string[];
    identifiers?: Array<{ type: string; value: string }>;
    language?: string;
  };
  coverImageBlob?: Blob;
  excerpt?: string;
};
```

`options` is `{ includeExcerpt?: boolean }`. Load the ZIP once, resolve `META-INF/container.xml` and parse the OPF with namespace-tolerant tag helpers. Only when `includeExcerpt` is true, map spine `itemref` IDs through manifest items and read at most the first three XHTML spine files until 6,000 normalized text characters are collected. Strip `script`, `style`, SVG markup and tags before decoding the basic XML entities `amp`, `lt`, `gt`, `quot`, `apos`, and numeric entities.

Keep `extractEpubCoverImage(blob)` as a compatibility wrapper returning `(await extractEpubPackage(blob, { includeExcerpt: false })).coverImageBlob`. In `createBookRecordFromFile`, call `extractEpubPackage(fileBlob, { includeExcerpt: false })` once for EPUB, place OPF query hints in an initial optional `enrichment` object as unprovenanced local fields with `status: "pending"` and the import timestamp as `attemptedAt`, and keep the filename-derived `title` as the top-level display title. Export `extractOpeningExcerpt(blob, format)`; TXT truncates normalized text directly, while EPUB calls `extractEpubPackage(blob, { includeExcerpt: true })` only during the later AI fallback.

- [ ] **Step 4: Run extraction and import tests**

Run: `npm test -- lib/epubPackage.test.ts lib/importBook.test.ts lib/epubCover.test.ts`

Expected: PASS; existing cover extraction behavior remains unchanged.

- [ ] **Step 5: Commit package extraction**

```bash
git add lib/epubPackage.ts lib/epubPackage.test.ts lib/epubCover.ts lib/epubCover.test.ts lib/importBook.ts lib/importBook.test.ts
git commit -m "feat: extract epub metadata hints"
```

## Task 4: Normalize and score public metadata candidates

**Files:**
- Create: `lib/bookMetadataProviders.ts`
- Create: `lib/bookMetadataProviders.test.ts`

- [ ] **Step 1: Write failing normalization and ranking tests**

Cover exact ISBN, Chinese punctuation, subtitles, author overlap and deterministic ties:

```ts
it("ranks an exact ISBN match above a title-only result", () => {
  const query = normalizeBookQuery({
    title: "资本论 第一卷",
    authors: ["卡尔·马克思"],
    identifiers: [{ type: "isbn", value: "9787010000000" }],
    format: "epub",
    needsCover: true,
  });
  expect(selectBestBookCandidate(query, [titleOnly, exactIsbn])).toMatchObject({
    candidate: exactIsbn,
    score: expect.any(Number),
  });
});

it("rejects an unrelated candidate below 0.72", () => {
  expect(selectBestBookCandidate(
    normalizeBookQuery({ title: "资本论", format: "txt", needsCover: false }),
    [{ ...exactIsbn, title: "百年孤独", authors: ["加西亚·马尔克斯"], identifiers: [] }]
  ).candidate).toBeNull();
});

it("normalizes Open Library and Google Books into the same shape", () => {
  expect(normalizeOpenLibraryWork(openLibraryFixture)).toMatchObject({ source: "open-library" });
  expect(normalizeGoogleVolume(googleFixture)).toMatchObject({ source: "google-books" });
});
```

- [ ] **Step 2: Run the provider-domain tests**

Run: `npm test -- lib/bookMetadataProviders.test.ts`

Expected: FAIL because the provider module is missing.

- [ ] **Step 3: Implement provider contracts and deterministic selection**

Export:

```ts
export type BookMetadataSearchInput = {
  title: string;
  authors?: string[];
  identifiers?: Array<{ type: string; value: string }>;
  language?: string;
  format: "epub" | "txt";
  needsCover: boolean;
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
  identifiers: Array<{ type: string; value: string }>;
  coverRef?: { source: "open-library" | "google-books"; id: string };
};
```

Build Open Library queries with `title`, optional `author`, and `isbn`; build Google Books `q` terms with `intitle:`, `inauthor:` and `isbn:`. Score exact valid ISBN first, then normalized title, author-token overlap, language and year. Reject title conflicts and scores below `0.72`. Sort by score, ISBN completeness, author score, description presence, then `${source}:${sourceId}`.

- [ ] **Step 4: Run provider-domain tests**

Run: `npm test -- lib/bookMetadataProviders.test.ts`

Expected: PASS for both response formats and all ranking cases.

- [ ] **Step 5: Commit matching logic**

```bash
git add lib/bookMetadataProviders.ts lib/bookMetadataProviders.test.ts
git commit -m "feat: rank public book metadata"
```

## Task 5: Add the public metadata search route

**Files:**
- Create: `lib/bookMetadataSearch.ts`
- Create: `lib/bookMetadataSearch.test.ts`
- Create: `app/api/book-metadata/search/route.ts`
- Create: `app/api/book-metadata/search/route.test.ts`

- [ ] **Step 1: Write failing orchestration and route tests**

Mock `fetch` and verify independent providers:

```ts
it("returns Open Library when Google Books is not configured", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(openLibraryResponse)));
  const result = await searchPublicBookMetadata(validInput, { fetcher, googleBooksApiKey: "" });
  expect(result.candidate?.source).toBe("open-library");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("keeps a valid provider result when the other provider times out", async () => {
  const result = await searchPublicBookMetadata(validInput, {
    fetcher: providerAwareFetcher({ google: new DOMException("Aborted", "AbortError"), openLibrary: openLibraryResponse }),
    googleBooksApiKey: "secret",
  });
  expect(result.candidate?.source).toBe("open-library");
});
```

Route tests must assert 400 for empty/overlong titles, 413 for over-limit JSON, 200 with `{ candidate: null, missing: ["description", "subjects"] }` for no match, and errors that never echo an API key.

- [ ] **Step 2: Run the search tests**

Run: `npm test -- lib/bookMetadataSearch.test.ts app/api/book-metadata/search/route.test.ts`

Expected: FAIL because the service and route are missing.

- [ ] **Step 3: Implement bounded partial-success search**

`searchPublicBookMetadata(input, options)` must start Open Library and configured Google Books requests concurrently, give each an `AbortSignal.timeout(4_500)`, request at most 10 candidates, read at most 512 KB of JSON, and convert provider failure into an empty provider result. Return the selected candidate, score, and `missing` fields.

The route must use `readLimitedJson(request)`, sanitize with `normalizeBookQuery`, call:

```ts
const result = await searchPublicBookMetadata(input, {
  fetcher: fetch,
  googleBooksApiKey: process.env.GOOGLE_BOOKS_API_KEY ?? "",
});
return Response.json(result, { headers: { "Cache-Control": "no-store" } });
```

Do not log the request body, provider URLs containing keys, or raw upstream errors.

- [ ] **Step 4: Run the search tests**

Run: `npm test -- lib/bookMetadataSearch.test.ts app/api/book-metadata/search/route.test.ts`

Expected: PASS for no-key, partial success, timeout, validation and safe-error cases.

- [ ] **Step 5: Commit the public search endpoint**

```bash
git add lib/bookMetadataSearch.ts lib/bookMetadataSearch.test.ts app/api/book-metadata/search/route.ts app/api/book-metadata/search/route.test.ts
git commit -m "feat: add public metadata search api"
```

## Task 6: Add the fixed-provider cover endpoint

**Files:**
- Create: `app/api/book-metadata/cover/route.ts`
- Create: `app/api/book-metadata/cover/route.test.ts`

- [ ] **Step 1: Write failing cover-security tests**

Test only these accepted forms:

```ts
it.each([
  ["open-library", "OL123M"],
  ["open-library", "9787010000000"],
  ["google-books", "zyTCAlFPjgYC"],
])("fetches a validated %s cover reference", async (source, id) => {
  const response = await GET(new Request(`http://localhost/api/book-metadata/cover?source=${source}&id=${id}`));
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("image/jpeg");
});
```

Add rejection cases for `id=https://internal/`, slash traversal, unsupported source, non-image MIME, more than two redirects, missing `Content-Length` with streamed body above 2 MB, and declared size above 2 MB.

- [ ] **Step 2: Run the cover-route test**

Run: `npm test -- app/api/book-metadata/cover/route.test.ts`

Expected: FAIL because the route is missing.

- [ ] **Step 3: Implement a non-generic image fetcher**

Validate IDs with provider-specific regular expressions. Construct URLs only as:

```ts
const url = source === "open-library"
  ? `https://covers.openlibrary.org/b/${/^OL/.test(id) ? "olid" : "isbn"}/${encodeURIComponent(id)}-L.jpg`
  : `https://books.google.com/books/content?id=${encodeURIComponent(id)}&printsec=frontcover&img=1&zoom=2&edge=curl`;
```

Fetch with a 4.5-second timeout and manual redirects; after every redirect validate hostname against `covers.openlibrary.org` or `books.google.com`. Accept JPEG, PNG, WebP and GIF only, read through a byte-counting stream capped at `2_097_152`, then return the Blob bytes with `Cache-Control: public, max-age=86400` and `X-Content-Type-Options: nosniff`.

- [ ] **Step 4: Run cover security tests**

Run: `npm test -- app/api/book-metadata/cover/route.test.ts`

Expected: PASS for allowed sources and every proxy-abuse case.

- [ ] **Step 5: Commit the cover endpoint**

```bash
git add app/api/book-metadata/cover/route.ts app/api/book-metadata/cover/route.test.ts
git commit -m "feat: fetch validated metadata covers"
```

## Task 7: Add strict AI completion for description and subjects

**Files:**
- Create: `lib/bookMetadataAi.ts`
- Create: `lib/bookMetadataAi.test.ts`
- Create: `app/api/book-metadata/complete/route.ts`
- Create: `app/api/book-metadata/complete/route.test.ts`

- [ ] **Step 1: Write failing AI response and route tests**

Lock the allowlist across all supported protocols:

```ts
it.each([
  ["openai-compatible", { choices: [{ message: { content: "{\"description\":\"简介\",\"subjects\":[\"经济学\"]}" } }] }, { description: "简介", subjects: ["经济学"] }],
  ["anthropic-compatible", { content: [{ type: "text", text: "{\"description\":\"简介\"}" }] }, { description: "简介" }],
  ["gemini", { candidates: [{ content: { parts: [{ text: "{\"subjects\":[\"经典\"]}" }] } }] }, { subjects: ["经典"] }],
])("extracts bounded completion from %s", (protocol, payload, expected) => {
  expect(parseMetadataAiResponse(protocol, payload, ["description", "subjects"]))
    .toEqual(expected);
});

it("drops facts and fields that were not requested", () => {
  expect(parseMetadataCompletionText(
    '{"description":"简介","authors":["伪造作者"],"publisher":"伪造出版社"}',
    ["description"]
  )).toEqual({ description: "简介" });
});
```

Route tests assert no AI request when `missing` is empty, 400 for unusable provider, excerpt truncation at 6,000 characters, 502 for malformed upstream JSON, and a response/error body that never contains the API key.

- [ ] **Step 2: Run the AI tests**

Run: `npm test -- lib/bookMetadataAi.test.ts app/api/book-metadata/complete/route.test.ts`

Expected: FAIL because AI metadata parsing and the route do not exist.

- [ ] **Step 3: Implement prompt, provider request and strict parsing**

Build a system instruction that says the model may return only:

```json
{"description":"纯文本简介","subjects":["标签"]}
```

It must state that unknown content is omitted, facts are not invented, HTML/Markdown is forbidden, and output is JSON only. Use `buildAiProviderRequest(provider, messages, { stream: false })`, `fetchAiUpstream`, a 64 KB bounded response reader, and protocol-specific text extraction. Strip optional fenced-code markers before `JSON.parse`, accept only requested keys, cap description at 12,000 characters and subjects at 16 items/80 characters each.

The route validates `provider`, `knownMetadata`, `missing` and `excerpt`, returns `{ completion, provenance: { source: "ai", generated: true } }`, and uses the existing generic `AI request failed` error vocabulary.

- [ ] **Step 4: Run the AI tests**

Run: `npm test -- lib/bookMetadataAi.test.ts app/api/book-metadata/complete/route.test.ts`

Expected: PASS for all three protocols, allowlist, limits and secret-safe failures.

- [ ] **Step 5: Commit AI completion**

```bash
git add lib/bookMetadataAi.ts lib/bookMetadataAi.test.ts app/api/book-metadata/complete/route.ts app/api/book-metadata/complete/route.test.ts
git commit -m "feat: complete missing metadata with ai"
```

## Task 8: Build the client enrichment coordinator and automatic trigger

**Files:**
- Create: `lib/bookMetadataEnrichment.ts`
- Create: `lib/bookMetadataEnrichment.test.ts`
- Create: `app/useBookMetadataEnrichment.ts`
- Modify: `app/page.tsx`

- [ ] **Step 1: Write failing coordinator tests**

Use injected dependencies to prove the privacy order:

```ts
it("does not read source bytes or call AI when public metadata is complete", async () => {
  const deps = makeDeps({ searchResult: completePublicResult });
  await enrichBookMetadata(makeBook(), "automatic", deps);
  expect(deps.getBookFile).not.toHaveBeenCalled();
  expect(deps.completeWithAi).not.toHaveBeenCalled();
  expect(deps.updateBookEnrichment).toHaveBeenCalledOnce();
});

it("reads only the target book excerpt when prose fields are missing", async () => {
  const deps = makeDeps({ searchResult: partialPublicResult, aiUsable: true });
  await enrichBookMetadata(makeBook({ id: "target" }), "manual", deps);
  expect(deps.getBookFile).toHaveBeenCalledWith("target");
  expect(deps.completeWithAi).toHaveBeenCalledWith(expect.objectContaining({
    excerpt: expect.any(String),
    missing: ["description", "subjects"],
  }));
});
```

Add cases for no AI provider, public no-match, previous good data retained on manual failure, cover download only when local cover is absent/scraped, and a stale task token unable to overwrite a newer result.

- [ ] **Step 2: Run coordinator tests**

Run: `npm test -- lib/bookMetadataEnrichment.test.ts`

Expected: FAIL because the coordinator is missing.

- [ ] **Step 3: Implement orchestration and the hook**

Export:

```ts
export async function enrichBookMetadata(
  book: BookMetadata,
  mode: "automatic" | "manual",
  deps: BookMetadataEnrichmentDependencies
): Promise<BookEnrichmentResult>;
```

The order is: persist `pending` → POST public search → optionally fetch allowed cover → only then load target source and POST AI completion → merge → atomic update. Convert network exceptions to safe error codes and retain previous good fields.

`useBookMetadataEnrichment` keeps `Map<bookId, { generation, controller }>` in a ref, returns `run(book, mode)` and `isRunning(bookId)`, ignores older generations, aborts all active tasks on unmount, and calls `onMetadataChanged(await listBookMetadata())` after a committed result.

In `handleImport`, after `saveBook(record)` and the first `setBooks`, schedule `void metadataEnrichment.run(record, "automatic")`. Do not await it and do not route failures into `importError`.

- [ ] **Step 4: Run coordinator and import regression tests**

Run: `npm test -- lib/bookMetadataEnrichment.test.ts lib/importBook.test.ts lib/db.test.ts`

Expected: PASS; import completion is independent of metadata requests.

- [ ] **Step 5: Commit client orchestration**

```bash
git add lib/bookMetadataEnrichment.ts lib/bookMetadataEnrichment.test.ts app/useBookMetadataEnrichment.ts app/page.tsx
git commit -m "feat: enrich imported books in background"
```

## Task 9: Add book-details navigation and restore behavior

**Files:**
- Modify: `lib/appNavigation.ts`
- Modify: `lib/appNavigation.test.ts`
- Modify: `app/AppPushSurfaces.tsx`
- Modify: `app/page.tsx`
- Modify: `lib/uiText.ts`
- Create: `app/BookDetailsSurface.tsx`

- [ ] **Step 1: Write failing navigation tests**

Add reducer coverage for library and search origins:

```ts
it("pushes book details above search and restores search on pop", () => {
  const searching = reduceAppNavigation(createAppNavigationState(), {
    type: "push",
    entry: { key: "search", kind: "push", route: "library-search" },
  });
  const details = reduceAppNavigation(searching, {
    type: "push",
    entry: {
      key: "details", kind: "push", route: "book-details",
      entityId: "book-1", restoreFocusId: "library-search-grid-book-1",
    },
  });
  expect(details.pushes.map((entry) => entry.route)).toEqual(["library-search", "book-details"]);
  expect(reduceAppNavigation(details, { type: "pop" }).pushes).toEqual(searching.pushes);
});

it("clears book details when a root tab is selected", () => {
  expect(reduceAppNavigation(detailsState, { type: "select-tab", tab: "settings" }).pushes).toEqual([]);
});
```

- [ ] **Step 2: Run navigation tests**

Run: `npm test -- lib/appNavigation.test.ts lib/navigationHistory.test.ts`

Expected: FAIL because `book-details` is not a valid `PushRoute` and the surface switch is exhaustive.

- [ ] **Step 3: Wire route entry without loading the reader**

Add `"book-details"` to `PushRoute`. In `handleBookPress`, keep editing selection behavior, then call:

```ts
navigation.push("book-details", {
  entityId: book.id,
  restoreFocusId: originId,
});
```

Derive `detailEntry`, `detailBook` and `detailPosition` from the top Push and existing metadata/progress maps. Pass a `details` data block through `AppPushSurfaces`; its switch renders `BookDetailsSurface`. Add UI text constants for back, more, start/continue, metadata actions and statuses.

If `detailEntry.entityId` no longer exists after loading completes, call `navigation.removeInvalid(detailEntry.key)`. Leave `openBookForReading` untouched in this task.

Create the compile-safe first surface with the final prop contract; Task 10 replaces its minimal body without changing callers:

```tsx
"use client";

import type { BookMetadata } from "@/lib/db";

export type BookDetailsSurfaceProps = {
  book: BookMetadata;
  progressPercent: number;
  lastReadAt?: string;
  originId?: string;
  metadataRunning: boolean;
  onBack: () => void;
  onRead: (originId: string) => void;
  onOpenContents: (originId: string) => void;
  onEnrich: (mode: "automatic" | "manual") => void;
};

export default function BookDetailsSurface({
  book,
  onBack,
}: BookDetailsSurfaceProps) {
  return (
    <section data-book-details="true">
      <button type="button" onClick={onBack} aria-label="返回">返回</button>
      <h1>{book.title}</h1>
    </section>
  );
}
```

- [ ] **Step 4: Run navigation tests and TypeScript through build**

Run: `npm test -- lib/appNavigation.test.ts lib/navigationHistory.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS with the compile-safe `BookDetailsSurface` created in this task.

- [ ] **Step 5: Commit route wiring**

```bash
git add lib/appNavigation.ts lib/appNavigation.test.ts app/AppPushSurfaces.tsx app/page.tsx lib/uiText.ts app/BookDetailsSurface.tsx
git commit -m "feat: route book presses to details"
```

## Task 10: Build the details presentation and accessible surface

**Files:**
- Create: `lib/bookDetailsPresentation.ts`
- Create: `lib/bookDetailsPresentation.test.ts`
- Modify: `app/BookDetailsSurface.tsx`
- Modify: `app/page.module.css`

- [ ] **Step 1: Write failing presentation tests**

Test exact decisions without DOM rendering dependencies:

```ts
it.each([
  [0, "开始阅读"],
  [0.01, "继续阅读"],
  [42, "继续阅读"],
])("maps progress %s to CTA %s", (progressPercent, expected) => {
  expect(buildBookDetailsPresentation(makeBook(), progressPercent).primaryActionLabel).toBe(expected);
});

it("shows contents only for EPUB and omits absent metadata rows", () => {
  const view = buildBookDetailsPresentation(makeBook({
    format: "txt",
    enrichment: { status: "partial", attemptedAt: now, authors: ["作者"] },
  }), 0);
  expect(view.showContentsAction).toBe(false);
  expect(view.metadataRows.map((row) => row.label)).toEqual(["作者", "格式", "文件大小", "原文件名"]);
});
```

- [ ] **Step 2: Run presentation tests**

Run: `npm test -- lib/bookDetailsPresentation.test.ts`

Expected: FAIL because the builder does not exist.

- [ ] **Step 3: Implement presentation builder and full UI**

`BookDetailsSurface` props must be:

```ts
type BookDetailsSurfaceProps = {
  book: BookMetadata;
  progressPercent: number;
  lastReadAt?: string;
  originId?: string;
  metadataRunning: boolean;
  onBack: () => void;
  onRead: (originId: string) => void;
  onOpenContents: (originId: string) => void;
  onEnrich: (mode: "automatic" | "manual") => void;
};
```

Use one `h1`, `BookCover`, semantic sections, progress text/track, conditional description/tags/metadata rows, and `aria-live="polite"` status. The more button opens a Motion popover with `role="menu"`; the single `menuitem` says “补全元数据”, “重新刮削元数据” or “正在重新刮削” and is disabled while running. Close on Escape/outside click and restore focus.

For transitions, render a library-origin outer `m.div` using `bookCoverLayoutId(originId)` and nest a `MotionBookCover` registered as `book-details-${book.id}`. Call `onRead("book-details-${book.id}")` so the existing reader transition uses the detail cover, not the covered library source.

Add CSS using only current variables. Reserve bottom padding for the existing 68px Dock plus safe area. Define fixed minimum status space, 44px targets, line clamping and reduced-motion rules; do not add new blur or palette values.

- [ ] **Step 4: Run presentation and accessibility contract tests**

Run: `npm test -- lib/bookDetailsPresentation.test.ts lib/accessibilityIntegration.test.ts`

Expected: PASS after adding detail assertions for one `h1`, `aria-live`, menu roles, 44px controls and reduced motion.

- [ ] **Step 5: Commit the details surface**

```bash
git add lib/bookDetailsPresentation.ts lib/bookDetailsPresentation.test.ts app/BookDetailsSurface.tsx app/page.module.css lib/accessibilityIntegration.test.ts
git commit -m "feat: add local-first book details surface"
```

## Task 11: Complete app integration, reader actions, background and Dock behavior

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/AppPushSurfaces.tsx`
- Modify: `app/MotionBookCover.tsx`
- Modify: `app/EpubReader.tsx`
- Create: `lib/bookDetailsIntegration.test.ts`
- Modify: `lib/ambientBookBackground.test.ts`
- Modify: `lib/readerTransitionMotion.test.ts`

- [ ] **Step 1: Write failing integration contracts**

The source-level integration test must assert:

```ts
expect(page).toContain('navigation.push("book-details"');
expect(page).not.toMatch(/function handleBookPress[\s\S]*?openBookForReading\(book, originId\)/);
expect(page).toContain('topPushRoute === "book-details"');
expect(page).toContain("detailBook ?? latestBook ?? null");
expect(pushSurfaces).toContain('case "book-details"');
expect(details).toContain('role="menu"');
expect(details).toContain('aria-live="polite"');
```

Add a reader transition assertion that details call `openBookForReading(book, detailOriginId)`. Add an ambient assertion that the top detail book overrides `latestBook`. Add a Dock assertion that it remains visible for `library-search` and `book-details` but is hidden for other Push routes.

- [ ] **Step 2: Run integration tests**

Run: `npm test -- lib/bookDetailsIntegration.test.ts lib/ambientBookBackground.test.ts lib/readerTransitionMotion.test.ts`

Expected: FAIL on missing detail wiring and visibility rules.

- [ ] **Step 3: Finish page wiring**

In `page.tsx`:

```ts
const bookDetailsOpen = topPushRoute === "book-details";
const showBottomTabs =
  (navigation.state.pushes.length === 0 || librarySearchOpen || bookDetailsOpen) &&
  shouldShowBottomTabs(activeTab, readerPresented);
const ambientBook = detailBook ?? latestBook ?? null;
```

Pass `ambientBook` to `AmbientBookBackground`. Wire `onRead` to `openBookForReading(detailBook, detailOriginId)`.

Add an optional `onTocReady` callback to `EpubReader`. Invoke it once after EPUB navigation loading settles, immediately after `onTocChange(items)`, including the valid empty-directory case. Wire EPUB `onOpenContents` through a ref-backed `pendingOpenTocBookId`: open the reader, then present the existing `toc` sheet when `onTocReady` fires for the same book. Clear the pending ID on file-load failure, book switch, reader dismissal or unmount. Add source assertions that `onTocReady` follows `onTocChange` and that a stale book ID cannot open a Sheet.

Wire `onEnrich` to the enrichment hook, update the `books` state after completion, and keep the previous details object visible during a manual failure. Update `MotionBookCover` only enough to support a nested detail wrapper without duplicate source registration or duplicate `layoutId` values.

- [ ] **Step 4: Run integration and navigation regression tests**

Run: `npm test -- lib/bookDetailsIntegration.test.ts lib/ambientBookBackground.test.ts lib/readerTransitionMotion.test.ts lib/appNavigation.test.ts lib/navigationMotion.test.ts`

Expected: PASS for detail-to-reader origin, ambient override, Dock persistence and back-stack behavior.

- [ ] **Step 5: Commit full app integration**

```bash
git add app/page.tsx app/AppPushSurfaces.tsx app/MotionBookCover.tsx app/EpubReader.tsx lib/bookDetailsIntegration.test.ts lib/ambientBookBackground.test.ts lib/readerTransitionMotion.test.ts
git commit -m "feat: integrate book details with reader"
```

## Task 12: Mobile end-to-end coverage, deployment documentation and final verification

**Files:**
- Create: `e2e/book-details.spec.ts`
- Modify: `docs/cloudflare-deploy.md`
- Modify: `HANDOFF.md`

- [ ] **Step 1: Write the mobile E2E scenarios**

Use the existing file chooser/import helpers and intercept metadata routes:

```ts
test("book opens details before reader and restores library focus", async ({ page }) => {
  await page.route("**/api/book-metadata/search", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ candidate: null, missing: ["description", "subjects"] }),
  }));
  await importFixture(page, "e2e/fixtures/sample.txt");
  const book = page.locator('[data-library-book-open="true"]').first();
  await book.focus();
  await book.click();
  await expect(page.locator('[data-push-route="book-details"]')).toBeVisible();
  await expect(page.locator('[data-reader-presented="true"]')).toHaveCount(0);
  await page.getByRole("button", { name: /开始阅读|继续阅读/ }).click();
  await expect(page.locator('[data-reader-presented="true"]')).toBeVisible();
  await page.goBack();
  await page.goBack();
  await expect(book).toBeFocused();
});
```

Add scenarios for search → details → search query restoration, public metadata rendering, manual retry after 502, AI route not called when public prose is complete, repeated manual clicks issuing one request, root-tab exit, and reduced-motion style/state. Seed progress/bookmarks before scrape and assert they are unchanged afterwards.

- [ ] **Step 2: Run focused E2E on one mobile project**

Run: `npm run test:e2e -- e2e/book-details.spec.ts --project=iphone-14 --trace=off`

Expected: PASS for all new scenarios. If the command rebuilds, no TypeScript or Next.js route error appears.

- [ ] **Step 3: Document optional Google Books configuration and update handoff**

Add this exact deployment behavior to `docs/cloudflare-deploy.md`:

```md
### Optional Google Books metadata source

Book metadata enrichment always supports Open Library. To add Google Books,
configure `GOOGLE_BOOKS_API_KEY` as a server-side Cloudflare secret. The key is
never exposed to the browser or included in reader backups. Without the secret,
the Google provider is skipped and import/reading remain fully functional.
```

Update `HANDOFF.md` with the feature summary, commit range, optional secret, new route list, database compatibility, exact local verification results and remaining real-iPhone checks. Preserve all earlier handoff sections; the production URL is added only after deployment.

- [ ] **Step 4: Run the full quality gate**

Run in this order:

```bash
npm test
npm run lint
npm run build
git diff --check
npm run test:e2e -- e2e/book-details.spec.ts e2e/native-navigation.spec.ts e2e/library-book-first.spec.ts --project=iphone-14 --trace=off
npm run test:e2e -- e2e/book-details.spec.ts --project=iphone-15-pro-max --trace=off
```

Expected: every command exits 0; no console error, unhandled rejection, hydration warning or accessibility regression appears.

- [ ] **Step 5: Perform browser visual checks**

At 390×844 verify library list, grid, search, local-only details, complete metadata, partial metadata, manual failure, reader entry and back restoration in light/dark/reduced-motion modes. Confirm no horizontal overflow, no content behind the Dock, no layout jump when metadata appears, and no second live blur layer.

- [ ] **Step 6: Commit documentation and verification coverage**

```bash
git add e2e/book-details.spec.ts docs/cloudflare-deploy.md HANDOFF.md
git commit -m "test: cover book details metadata flow"
```

- [ ] **Step 7: Push, deploy and verify production**

First confirm `git status -sb` is clean and the branch contains only intentional commits. Then run:

```bash
git push origin feat/pwa-interaction-fluidity
npm run deploy:cf
```

Record the deployed URL from Wrangler. Open that URL at 390×844, import a small TXT, confirm details precede the reader, trigger a no-key Open Library scrape, test manual failure recovery, inspect console/network errors, and append the production verification result to `HANDOFF.md`. Commit and push the handoff-only verification update if the deployment URL or results changed.

## Plan self-review checklist

- [ ] Every confirmed design requirement maps to a task: navigation (9/11), visual reuse (10/11), public matching (4/5), cover security (6), AI privacy (7/8), auto/manual trigger (8/10), compatibility (2/3), accessibility/motion (10/11), verification/deployment (12).
- [ ] No task introduces favorites, sharing, candidate selection, cloud library, batch scraping, a second TOC parser, a new theme, or a generic URL proxy.
- [ ] Function and type names stay consistent: `BookEnrichment`, `mergeBookEnrichment`, `updateBookEnrichment`, `extractEpubPackage`, `searchPublicBookMetadata`, `enrichBookMetadata`, `BookDetailsSurface`.
- [ ] The execution must remain inline in the current worktree because the user explicitly prohibited subagents.
