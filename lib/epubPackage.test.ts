import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  extractEpubPackage,
  extractOpeningExcerpt,
} from "./epubPackage";

async function makeEpubBlob(
  opf: string,
  files: Record<string, string | Uint8Array> = {}
): Promise<Blob> {
  const zip = new JSZip();
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?>
    <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
      <rootfiles><rootfile full-path="OPS/package.opf"/></rootfiles>
    </container>`
  );
  zip.file("OPS/package.opf", opf);
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  const bytes = await zip.generateAsync({ type: "uint8array" });
  const copied = new Uint8Array(bytes.byteLength);
  copied.set(bytes);
  return new Blob([copied.buffer], { type: "application/epub+zip" });
}

describe("extractEpubPackage", () => {
  it("extracts namespaced metadata, cover and opening spine text", async () => {
    const result = await extractEpubPackage(
      await makeEpubBlob(
        `<package xmlns:dc="http://purl.org/dc/elements/1.1/">
          <metadata>
            <dc:title>资本论</dc:title>
            <dc:creator>卡尔·马克思</dc:creator>
            <dc:creator>马克思</dc:creator>
            <dc:identifier id="isbn">9787010000000</dc:identifier>
            <dc:language>zh-CN</dc:language>
          </metadata>
          <manifest>
            <item id="cover" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/>
            <item id="c1" href="chapter-1.xhtml" media-type="application/xhtml+xml"/>
          </manifest>
          <spine><itemref idref="c1"/></spine>
        </package>`,
        {
          "OPS/cover.jpg": "cover",
          "OPS/chapter-1.xhtml":
            "<html><body><style>hidden</style><h1>第一章</h1><p>商品的价值形式。</p><script>secret</script></body></html>",
        }
      ),
      { includeExcerpt: true }
    );

    expect(result.metadata).toEqual({
      title: "资本论",
      authors: ["卡尔·马克思", "马克思"],
      identifiers: [{ type: "ISBN", value: "9787010000000" }],
      language: "zh-CN",
    });
    expect(result.coverImageBlob?.type).toBe("image/jpeg");
    expect(await result.coverImageBlob?.text()).toBe("cover");
    expect(result.excerpt).toContain("第一章 商品的价值形式。");
    expect(result.excerpt).not.toContain("hidden");
    expect(result.excerpt).not.toContain("secret");
  });

  it("does not read opening text unless requested", async () => {
    const result = await extractEpubPackage(
      await makeEpubBlob(
        `<package><manifest>
          <item id="c1" href="chapter.xhtml" media-type="application/xhtml+xml"/>
        </manifest><spine><itemref idref="c1"/></spine></package>`,
        { "OPS/chapter.xhtml": "<p>private opening text</p>" }
      ),
      { includeExcerpt: false }
    );

    expect(result.excerpt).toBeUndefined();
  });

  it("decodes XML entities and truncates the excerpt", async () => {
    const result = await extractEpubPackage(
      await makeEpubBlob(
        `<package><manifest>
          <item id="c1" href="chapter.xhtml" media-type="application/xhtml+xml"/>
        </manifest><spine><itemref idref="c1"/></spine></package>`,
        { "OPS/chapter.xhtml": `<p>A &amp; B &#20013; ${"x".repeat(7_000)}</p>` }
      ),
      { includeExcerpt: true }
    );

    expect(result.excerpt?.startsWith("A & B 中")).toBe(true);
    expect(result.excerpt?.length).toBeLessThanOrEqual(6_000);
  });

  it("returns an empty safe result for a malformed EPUB", async () => {
    await expect(
      extractEpubPackage(new Blob(["not a zip"]), { includeExcerpt: true })
    ).resolves.toEqual({ metadata: {} });
  });
});

describe("extractOpeningExcerpt", () => {
  it("normalizes and truncates TXT opening text", async () => {
    const excerpt = await extractOpeningExcerpt(
      new Blob([`  第一段\n\n${"文".repeat(7_000)}`], { type: "text/plain" }),
      "txt"
    );

    expect(excerpt.startsWith("第一段 文")).toBe(true);
    expect(excerpt.length).toBe(6_000);
  });
});
