import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  extractEpubCoverImage,
  findEpubCoverManifestItem,
  resolveEpubResourcePath,
} from "./epubCover";

async function makeEpubBlob(opf: string, files: Record<string, string | Uint8Array> = {}) {
  const zip = new JSZip();
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?>
    <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
      <rootfiles>
        <rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml"/>
      </rootfiles>
    </container>`
  );
  zip.file("OPS/package.opf", opf);
  Object.entries(files).forEach(([path, content]) => zip.file(path, content));
  const data = await zip.generateAsync({ type: "uint8array" });
  return new Blob([data], { type: "application/epub+zip" });
}

describe("findEpubCoverManifestItem", () => {
  it("finds an EPUB 3 cover-image manifest item", () => {
    const item = findEpubCoverManifestItem(`
      <package>
        <manifest>
          <item id="cover" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>
        </manifest>
      </package>
    `);

    expect(item).toEqual({ href: "images/cover.jpg", mediaType: "image/jpeg" });
  });

  it("finds an EPUB 2 meta cover item", () => {
    const item = findEpubCoverManifestItem(`
      <package>
        <metadata><meta name="cover" content="cover-id"/></metadata>
        <manifest>
          <item id="cover-id" href="cover.png" media-type="image/png"/>
        </manifest>
      </package>
    `);

    expect(item).toEqual({ href: "cover.png", mediaType: "image/png" });
  });
});

describe("resolveEpubResourcePath", () => {
  it("resolves cover paths relative to the OPF package file", () => {
    expect(resolveEpubResourcePath("OPS/package.opf", "images/cover.jpg")).toBe(
      "OPS/images/cover.jpg"
    );
  });

  it("normalizes parent segments", () => {
    expect(resolveEpubResourcePath("OPS/text/package.opf", "../images/cover.jpg")).toBe(
      "OPS/images/cover.jpg"
    );
  });
});

describe("extractEpubCoverImage", () => {
  it("extracts a cover image blob from an EPUB", async () => {
    const epub = await makeEpubBlob(
      `<package>
        <manifest>
          <item id="cover" href="images/cover.png" media-type="image/png" properties="cover-image"/>
        </manifest>
      </package>`,
      { "OPS/images/cover.png": "fake image bytes" }
    );

    const cover = await extractEpubCoverImage(epub);

    expect(cover).toBeInstanceOf(Blob);
    expect(cover?.type).toBe("image/png");
    expect(await cover?.text()).toBe("fake image bytes");
  });

  it("returns undefined when no cover is declared", async () => {
    const epub = await makeEpubBlob(
      `<package>
        <manifest>
          <item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
      </package>`
    );

    await expect(extractEpubCoverImage(epub)).resolves.toBeUndefined();
  });
});
