# Surface Architecture and Visual System Design

## Goal

Resolve the remaining four interface problems without changing storage, backup,
AI, or reader data contracts:

1. Reduce the size and responsibility density of `app/page.tsx`.
2. Replace mixed visual token families with one semantic token layer.
3. Remove the card-heavy composition from the reading dashboard.
4. Replace generic dark fallback covers with typographic paper covers.

The result should remain a quiet, Chinese, local-first iPhone reading utility.

## Scope

### In scope

- Extract presentational surfaces from `Home`.
- Introduce semantic color and surface tokens.
- Restyle the reading dashboard as unframed sections.
- Redesign generated fallback book covers.
- Preserve light, dark, sepia, and system themes.
- Add structural and visual regression tests.

### Out of scope

- No Context, Redux, Zustand, or new state-management dependency.
- No IndexedDB schema changes.
- No backup format changes.
- No AI request or provider changes.
- No reader progress or pagination behavior changes.
- No full application redesign.

## Architecture

`Home` remains the orchestration boundary. It owns:

- IndexedDB loading and mutation.
- Cross-surface application state.
- Reader lifecycle and gesture handlers.
- AI question state.
- Sheet and confirmation state.
- Persistence and browser APIs.

Four presentational boundaries are extracted:

### `LibrarySurface`

Owns rendering for:

- Library and collections screens.
- Search and view controls.
- Grid/list book presentation.
- Editing and selection presentation.

It receives records, derived values, and callbacks. It does not access IndexedDB.

### `ReadingDashboard`

Owns rendering for:

- Today's reading summary.
- Continue-reading row.
- Seven-day reading visualization.

It receives already-derived statistics and callbacks.

### `SettingsSurface`

Owns rendering for:

- Application preferences.
- AI provider summary and entry point.
- Backup controls.
- Privacy and application information.

It receives values and update callbacks. Persistence remains in `Home`.

### `AppOverlays`

Owns the centralized rendering of:

- Group and collection sheets.
- Book action and deletion confirmations.
- Batch actions.
- Reader appearance, contents, AI, and goal sheets.

Overlay state and behavior remain owned by `Home`.

The target is to reduce `app/page.tsx` from about 3,027 lines to roughly
1,600-1,900 lines without moving complex orchestration merely to hide it.

## Semantic Token Layer

The primary component-facing tokens are:

- `--app-bg`
- `--surface-primary`
- `--surface-secondary`
- `--text-primary`
- `--text-secondary`
- `--text-tertiary`
- `--separator`
- `--tint`
- `--control-fill`
- `--overlay-fill`
- `--sheet-fill`

Each supported theme defines this semantic layer.

Existing `--ios-*`, generic Web, and liquid-glass variables remain temporarily
as compatibility aliases where needed. New and migrated component rules should
consume semantic tokens.

Liquid Glass styling is limited to:

- Bottom primary navigation.
- Reader floating controls.
- Sheets and active overlays.

Ordinary content sections must not use blur, glass borders, or glass shadows.

## Reading Dashboard

The reading dashboard becomes three unframed sections:

1. Today's reading summary.
2. Continue reading.
3. Recent seven-day activity.

Hierarchy is created with:

- Spacing.
- Type weight.
- Small tint accents.
- Hairline separators where useful.

The dashboard removes:

- Gradient card backgrounds.
- Large independent shadows.
- Floating section containers.
- Decorative nested card composition.

The existing goal, continue-reading, and activity interactions remain intact.

## Generated Book Covers

Real extracted covers remain unchanged and take priority.

Fallback covers use a paper-cover composition:

- Light or middle-light paper surface.
- Fine outer border.
- Narrow colored spine.
- Book title set directly on the cover, limited to three lines.
- Small `EPUB` or `TXT` mark.
- Stable title-derived color used only for the spine and small mark.

The cover must work at both list and grid sizes. Long Chinese and Latin titles
must not overflow. The format mark remains legible but secondary.

## Motion

This work does not add page-load choreography.

Existing navigation and reader-control motion remains. New surface components
inherit current state transitions. Reduced-motion behavior remains unchanged.

## Compatibility

- No database migration.
- Existing books and covers remain valid.
- Existing backups remain valid.
- Existing API keys remain excluded from backups.
- Existing reading modes and progress remain unchanged.

## Testing

### Structural tests

- `Home` imports and renders all four surface boundaries.
- Library, reading dashboard, settings, and overlay markup does not return to
  the main orchestration file.

### Token tests

- Every supported theme defines the semantic token layer.
- Migrated ordinary content components do not use liquid-glass tokens.

### Reading dashboard tests

- All three functional sections remain.
- Dashboard styles do not use gradients or large card shadows.

### Cover tests

- Stable title-derived fallback style.
- Title and format mark are rendered for missing covers.
- Real cover blobs still take priority.
- Generated titles are constrained to three lines.

### Verification

- Full Vitest suite.
- ESLint.
- Production build.
- `git diff --check`.
- Browser verification at desktop and 390 x 844.
- Light, dark, and sepia theme inspection.
- Grid and list library inspection.
- Reading dashboard and reader overlay inspection.

## Acceptance Criteria

- `app/page.tsx` is materially smaller and easier to navigate.
- Components use one semantic visual vocabulary.
- The reading dashboard reads as content sections, not a stack of cards.
- Missing-cover books resemble designed book covers rather than file tiles.
- No text overlaps at phone or desktop sizes.
- Existing storage, reading, AI, and backup tests remain green.
