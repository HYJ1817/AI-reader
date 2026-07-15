import { expect, test } from "@playwright/test";
import JSZip from "jszip";

const libraryRoot =
  '[data-navigation-root="library"][aria-hidden="false"]';

async function buildLongEpub(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
      <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
        <rootfiles>
          <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
        </rootfiles>
      </container>`
  );

  const manifest: string[] = [];
  const spine: string[] = [];
  const navigation: string[] = [];
  const paragraph =
    "这是一段用于验证整本书页数计算的正文，阅读器不能把这本明显很长的书显示成一页。";

  for (let chapter = 1; chapter <= 12; chapter += 1) {
    const fileName = `chapter-${chapter}.xhtml`;
    manifest.push(
      `<item id="chapter-${chapter}" href="${fileName}" media-type="application/xhtml+xml"/>`
    );
    spine.push(`<itemref idref="chapter-${chapter}"/>`);
    navigation.push(`<li><a href="${fileName}">第 ${chapter} 章</a></li>`);
    zip.file(
      `OEBPS/${fileName}`,
      `<?xml version="1.0" encoding="utf-8"?>
        <html xmlns="http://www.w3.org/1999/xhtml">
          <head><title>第 ${chapter} 章</title></head>
          <body>
            <h1>第 ${chapter} 章</h1>
            ${Array.from(
              { length: 50 },
              (_, index) => `<p>${paragraph}${index + 1}</p>`
            ).join("")}
          </body>
        </html>`
    );
  }

  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="utf-8"?>
      <package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:identifier id="book-id">epub-page-check</dc:identifier>
          <dc:title>EPUB Page Check</dc:title>
          <dc:language>zh-CN</dc:language>
        </metadata>
        <manifest>
          <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
          ${manifest.join("")}
        </manifest>
        <spine>${spine.join("")}</spine>
      </package>`
  );
  zip.file(
    "OEBPS/nav.xhtml",
    `<?xml version="1.0" encoding="utf-8"?>
      <html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
        <head><title>目录</title></head>
        <body><nav epub:type="toc"><ol>${navigation.join("")}</ol></nav></body>
      </html>`
  );

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

test("EPUB page label resolves from calculating to a whole-book count", async ({
  page,
}) => {
  await page.goto("/");
  const library = page.locator(libraryRoot);
  await expect(library).toBeVisible();
  await expect(
    library.locator('[data-library-loading="false"]')
  ).toHaveCount(1);

  await page.locator('input[type="file"][accept*=".epub"]').setInputFiles({
    name: "epub-page-check.epub",
    mimeType: "application/epub+zip",
    buffer: await buildLongEpub(),
  });
  const cover = library.locator("[data-book-cover-origin]").first();
  await expect(cover).toBeVisible();
  await cover.click();
  await expect(page.locator('[data-reader-presented="true"]')).toBeVisible();

  const chrome = page.locator('[data-reader-chrome-controls="true"]');
  await expect(chrome).toContainText("正在计算页数…");
  const observedLabels: string[] = [];
  await expect
    .poll(
      async () => {
        const label = (await chrome.innerText()).match(/1\/(\d+)页/);
        if (!label) return 0;
        observedLabels.push(label[0]);
        return Number(label[1]);
      },
      { timeout: 30_000 }
    )
    .toBeGreaterThan(1);
  expect(observedLabels).not.toContain("1/1页");
});
