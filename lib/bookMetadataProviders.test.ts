import { describe, expect, it } from "vitest";
import {
  buildGoogleBooksQuery,
  buildOpenLibraryQuery,
  normalizeBookQuery,
  normalizeGoogleVolume,
  normalizeOpenLibraryWork,
  selectBestBookCandidate,
  type NormalizedBookCandidate,
} from "./bookMetadataProviders";

const exactIsbn: NormalizedBookCandidate = {
  source: "open-library",
  sourceId: "OL1M",
  title: "资本论：第一卷",
  authors: ["卡尔·马克思"],
  subjects: ["政治经济学"],
  identifiers: [{ type: "ISBN", value: "9787010000000" }],
};

const titleOnly: NormalizedBookCandidate = {
  source: "google-books",
  sourceId: "volume-1",
  title: "资本论 第一卷",
  authors: ["马克思"],
  subjects: [],
  identifiers: [],
};

describe("provider query normalization", () => {
  it("builds bounded provider queries from the strongest hints", () => {
    const query = normalizeBookQuery({
      title: " 资本论：第一卷 ",
      authors: ["卡尔·马克思"],
      identifiers: [{ type: "isbn", value: "978-7-01-000000-0" }],
      language: "zh-CN",
      format: "epub",
      needsCover: true,
    });

    expect(buildOpenLibraryQuery(query)).toMatchObject({
      title: "资本论：第一卷",
      author: "卡尔·马克思",
      isbn: "9787010000000",
    });
    expect(buildGoogleBooksQuery(query)).toBe(
      "intitle:资本论：第一卷 inauthor:卡尔·马克思 isbn:9787010000000"
    );
  });
});

describe("provider response normalization", () => {
  it("normalizes Open Library and Google Books into the same shape", () => {
    expect(
      normalizeOpenLibraryWork({
        key: "/works/OL1W",
        title: "资本论",
        author_name: ["卡尔·马克思"],
        first_publish_year: 1867,
        language: ["chi", "ger"],
        isbn: ["9787010000000"],
        publisher: ["人民出版社"],
        subject: ["政治经济学"],
        cover_i: 123,
      })
    ).toMatchObject({
      source: "open-library",
      sourceId: "OL1W",
      title: "资本论",
      authors: ["卡尔·马克思"],
      publisher: "人民出版社",
      publishedDate: "1867",
      coverRef: { source: "open-library", id: "123" },
    });

    expect(
      normalizeGoogleVolume({
        id: "g1",
        volumeInfo: {
          title: "资本论",
          authors: ["卡尔·马克思"],
          description: "政治经济学批判。",
          categories: ["经济学"],
          publisher: "人民出版社",
          publishedDate: "2004-01",
          language: "zh",
          industryIdentifiers: [{ type: "ISBN_13", identifier: "9787010000000" }],
          imageLinks: { thumbnail: "https://books.google.com/cover.jpg" },
        },
      })
    ).toMatchObject({
      source: "google-books",
      sourceId: "g1",
      description: "政治经济学批判。",
      subjects: ["经济学"],
      coverRef: { source: "google-books", id: "g1" },
    });
  });

  it("drops malformed provider records", () => {
    expect(normalizeOpenLibraryWork({ key: "/works/empty" })).toBeUndefined();
    expect(normalizeGoogleVolume({ id: "empty", volumeInfo: {} })).toBeUndefined();
  });
});

describe("selectBestBookCandidate", () => {
  const query = normalizeBookQuery({
    title: "资本论 第一卷",
    authors: ["卡尔·马克思"],
    identifiers: [{ type: "isbn", value: "9787010000000" }],
    language: "zh-CN",
    format: "epub",
    needsCover: true,
  });

  it("ranks an exact ISBN match above a title-only result", () => {
    expect(selectBestBookCandidate(query, [titleOnly, exactIsbn])).toMatchObject({
      candidate: exactIsbn,
      score: expect.any(Number),
    });
  });

  it("handles Chinese punctuation and subtitle separators", () => {
    const selected = selectBestBookCandidate(
      normalizeBookQuery({
        title: "资本论—第一卷",
        format: "txt",
        needsCover: false,
      }),
      [titleOnly]
    );
    expect(selected.candidate).toEqual(titleOnly);
    expect(selected.score).toBeGreaterThanOrEqual(0.72);
  });

  it("rejects an unrelated candidate below 0.72", () => {
    const selected = selectBestBookCandidate(
      normalizeBookQuery({ title: "资本论", format: "txt", needsCover: false }),
      [
        {
          ...exactIsbn,
          title: "百年孤独",
          authors: ["加西亚·马尔克斯"],
          identifiers: [],
        },
      ]
    );
    expect(selected.candidate).toBeNull();
    expect(selected.score).toBeLessThan(0.72);
  });

  it("uses stable source IDs to break otherwise identical ties", () => {
    const candidate = { ...titleOnly, source: "open-library" as const };
    const selected = selectBestBookCandidate(
      normalizeBookQuery({ title: titleOnly.title, format: "txt", needsCover: false }),
      [
        { ...candidate, sourceId: "OL-Z" },
        { ...candidate, sourceId: "OL-A" },
      ]
    );
    expect(selected.candidate?.sourceId).toBe("OL-A");
  });
});
