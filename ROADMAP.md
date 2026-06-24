# AI Reader Roadmap

## Deferred: In-App Web Browser and Direct Book Downloads

Status: Deferred until an iOS native build and device-testing workflow is
available.

Goal:

- Let the user browse arbitrary websites from inside AI Reader.
- Detect EPUB and TXT downloads initiated by the user.
- Import completed downloads directly into the existing local bookshelf.
- Keep the current reader, library, IndexedDB data, settings, and backup
  behavior instead of rewriting the product as a native app.

Recommended architecture:

- Preserve the existing Next.js reader as the main application.
- Add a thin iOS native shell when this work resumes.
- Use `WKWebView` for full web browsing.
- Use `WKNavigationDelegate`, `WKDownload`, and `WKDownloadDelegate` to detect
  and manage downloads.
- Pass downloaded EPUB or TXT files through a narrow native-to-web import
  bridge that reuses the existing validation, metadata extraction, cover
  extraction, and `saveBook` flow.

Why this is deferred:

- A pure PWA cannot reliably embed arbitrary sites because sites may block
  framing with `X-Frame-Options` or CSP `frame-ancestors`.
- Cross-origin and browser security rules prevent a PWA from reliably
  intercepting every external download and reading its bytes.
- Building and testing the native shell requires access to macOS, Xcode,
  signing, and an iPhone or simulator workflow.

Constraints:

- Do not turn this into a search index, bundled pirate source, or fixed book
  catalog.
- The user chooses websites and downloads files manually.
- Support EPUB and TXT first.
- Validate file type, extension, MIME type, size, and basic file integrity
  before importing.
- Do not expose IndexedDB, API keys, or other reader data to browsed websites.
- Keep browser cookies and website storage isolated from reader data.
- Provide visible download progress, cancel, failure, duplicate, and success
  states.

Resume prerequisites:

1. A Mac or cloud Mac with a supported Xcode version.
2. Apple signing configured for development builds.
3. A repeatable install and test path using a connected iPhone, simulator, or
   TestFlight.
4. A decision on whether the web app is bundled locally or loaded from the
   deployed AI Reader origin.
5. A written security review for navigation, downloads, cookies, redirects,
   authentication challenges, and the native-to-web bridge.

Initial acceptance criteria:

1. Open arbitrary HTTPS pages in an in-app browser with back, forward, reload,
   address/search, and close controls.
2. Handle new-window links without losing the reader.
3. Detect EPUB and TXT responses and show download progress.
4. Import a valid completed file into the existing bookshelf without opening
   it automatically.
5. Reject unsupported, oversized, malformed, or misleading downloads with a
   clear error.
6. Preserve books, progress, annotations, groups, preferences, and backups
   across app updates.
7. Confirm behavior on a real iPhone before declaring the feature complete.
