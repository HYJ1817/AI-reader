# Dark Reader Black Canvas Design

## Goal

Make the reading interface reliably pure black in explicit Dark mode and in
System mode when the operating system uses a dark color scheme. This replaces
the unresolved transparent EPUB ambient treatment in dark mode. Light and
Sepia reading behavior, and every non-reader application surface, remain
unchanged.

## Scope

- Apply `#000000` to the complete reader presentation stack in effective dark
  mode: the reader shell, stage, EPUB viewport, epub.js container and view, the
  iframe element, and the iframe document roots and non-media publisher
  elements.
- Keep the existing light foreground colors and typography controls.
- Preserve images, SVG, video, canvas, and picture content rather than painting
  over media.
- Treat explicit Dark and System-with-dark-preference identically.
- Keep explicit Light and Sepia reader canvases on their existing behavior.
- Do not change Settings, Library, Reading dashboard, navigation materials,
  application-wide dark tokens, persistence, backups, or reader preferences.

## Design

The reader will expose an effective dark-canvas state at its host boundary.
CSS will use that state to make the outer reader layers opaque black, ensuring
that the cover-derived ambient background cannot bleed around the EPUB page.

The same effective state will be passed into the EPUB theme and rendered-canvas
helpers. In dark mode they will set the epub.js view layers, iframe roots,
publisher non-media elements, and pseudo-elements to pure black. In Light and
Sepia modes they will retain the current transparent canvas behavior. System
mode will react to `prefers-color-scheme` changes through the existing media
query revision flow.

This is deliberately reader-scoped. The global `--background`, `--app-bg`,
surface, card, Dock, and sheet tokens will not be changed.

## Error and Compatibility Behavior

The canvas helpers will remain null-safe for incomplete epub.js views and
documents. Theme changes and newly rendered spine documents must receive the
same canvas policy, so moving between chapters cannot restore a publisher white
background. Media exclusions remain intact.

## Verification

- Add focused unit coverage for dark black and non-dark transparent EPUB theme
  rules.
- Add helper coverage proving dark black is applied across view/document layers
  while media elements are preserved.
- Update integration contracts for reader-host and epub.js layer behavior.
- Run the focused EPUB suites, then the repository-required Vitest, lint,
  production build, native-navigation Playwright, `git diff --check`, and Git
  status gates before the implementation commit.
- Physical iPhone/PWA validation and the APK endpoint are explicitly outside
  this change's acceptance gate per user direction.

## Delivery

Update the existing PR #5 with the implementation and verification evidence,
merge it after required checks pass, and then reconcile repository-facing
documentation and GitHub metadata with the merged state. Production deployment
is not included unless separately authorized.
