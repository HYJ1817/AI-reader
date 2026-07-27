# AI Provider Configuration Polish Design

## Goal

Turn the AI provider configuration push surface into a compact, deliberate
iOS-style settings experience and remove avoidable transition work so the
route is architecturally suitable for a 120Hz iPhone display.

The implementation must preserve provider creation, editing, deletion, model
refresh, manual model entry, local API-key storage, browser history, edge-back,
focus, reduced motion, and all four application themes.

## Current Problems

The current configure surface presents five tall provider rows, each repeating
a URL. The selector consumes most of the first viewport before the user reaches
the fields needed to complete setup. The independent section label/card pairs
for name and API Key fragment the form, while API address, path, model state,
refresh, manual entry, and the final action do not read as one ordered task.

The push transition mounts the complete configure surface while the navigation
stack also animates `filter: brightness(...)` on the preceding surface. The
existing browser performance check exercises a generic push route and allows a
very broad cadence ceiling; it does not measure the real AI provider list to
configuration path. A 60Hz Chromium emulation cannot prove physical 120fps,
but it can reject main-thread stalls, layout shifts, expensive paint paths, and
non-compositor transition properties before device testing.

## Chosen Direction

Use a restrained iOS grouped-form layout rather than a decorative dashboard or
a multi-step wizard. The page remains one scrollable configuration surface so
experienced users can review every value without moving between steps.

### Header

- Keep the native push header and centered title.
- Use the short back label `服务商` on the configure route.
- Preserve a minimum 44px back target, safe-area behavior, browser Back, and
  edge-back gesture ownership.
- Do not add a large hero, illustration, gradient, or separate introductory
  card.

### Provider Choice

- Replace the five tall URL rows with a compact wrapped provider picker.
- Each native button contains the existing provider mark and a concise name.
- The five choices remain visible without horizontal scrolling.
- Selected state uses tint, a restrained filled surface, a check indicator,
  and `aria-pressed`; color is not the only selection cue.
- Default URLs are not repeated in the picker. The selected preset immediately
  materializes its URL in the API address field, preserving current behavior.
- Every choice retains at least a 44px touch target and remains usable at 200%
  browser text size without horizontal page overflow.

### Connection Form

- Group `名称`, `API Key`, and `API 地址` into one surface with internal
  dividers and persistent field labels.
- Labels remain visible while typing; placeholders provide examples rather
  than acting as labels.
- API Key remains a password input with autocomplete disabled.
- The default-path control remains directly below API address in the same
  connection group. Before a preset is selected it shows the existing truthful
  unavailable state; afterward it keeps the existing append-path switch.
- Focus uses the existing application focus ring and a subtle field-level
  surface response without moving layout.

### Model Section

- Give `模型` one grouped header with the refresh action aligned to it.
- Keep remote and manual models in the same list and preserve pressed/selected
  semantics, deletion, Enter-to-add, busy state, and status/error text.
- The empty state becomes a concise instruction inside the model surface.
- Model refresh remains explicit; entering or switching to this page must not
  make a network request.

### Primary Action

- Place `保存并使用` in a sticky bottom action area above the safe-area inset.
- The action area uses an opaque theme surface and top hairline so fields do
  not show through while scrolling.
- Disabled state remains visibly disabled and retains native button semantics.
- Editing retains a separate destructive delete action in document flow; the
  destructive action is never adjacent to the primary action as an equal
  choice.

### Spacing and Typography

- Use the existing application typeface and theme tokens.
- Use a consistent compact rhythm: 8px within controls, 12px between closely
  related elements, and 20-24px between task groups.
- Keep body/input text at a readable mobile size and secondary text at WCAG AA
  contrast in Light, Sepia, Dark, and system-dark themes.
- Avoid nested decorative cards, excessive shadows, glass blur, and repeated
  captions.

## Transition Architecture

The push stack will keep the current spatial navigation and interruption
behavior, but the preceding surface must no longer animate a CSS filter.

- The incoming surface moves only with `transform` and, for reduced motion,
  the existing short opacity crossfade.
- The preceding surface keeps its existing transform depth cue.
- Any dimming needed for hierarchy is rendered by a dedicated pointer-inert
  overlay whose native `opacity` is animated. The overlay and incoming surface
  are independent compositor layers; no inherited custom property, filter,
  backdrop filter, blur, width, height, inset, or other layout property changes
  per frame.
- Edge-back tracking and settle reuse the same transform/opacity layers so an
  interrupted gesture never jumps between visual models.
- `will-change` is limited to layers that are actively participating in the
  transition and is not added to the provider page's static content.
- Reduced motion removes spatial travel and overlay interpolation while keeping
  navigation, focus, and history behavior intact.

The provider configure subtree should remain cheap to mount. Preset metadata
stays module-level and no network/storage work is added to render. Memoization
or component extraction is acceptable only when measurement shows it removes
work; the five-choice picker alone does not justify speculative caching.

## Accessibility and Resilience

- All choices, refresh, model rows, save, delete, and Back remain native
  controls.
- Provider and model choices expose `aria-pressed` and visible non-color state.
- Refresh exposes `aria-busy`; result text remains a polite status region.
- The push stack preserves inert state for hidden surfaces and restores focus
  through the existing navigation contract.
- Inputs retain programmatic labels, visible focus, keyboard operation, and
  software-keyboard-safe scrolling.
- Long provider/model names truncate only secondary presentation text; input
  values remain editable and accessible.
- Theme and reduced-motion behavior must be verified rather than inferred.

## Performance Acceptance

Add a dedicated cold-path browser test that starts on the AI provider list and
activates the real `添加 AI 服务商` control. It must not inject the destination
route directly or warm the configure surface first.

For the unthrottled iPhone 14 and iPhone 15 Pro Max Chromium profiles, one
explicit trace-off run per profile must establish:

- the configure route becomes visible within 34ms of the real click;
- at least 40 animation-frame samples are collected over the transition;
- P95 frame interval is at most 20ms;
- maximum frame interval is at most 34ms;
- maximum long task duration is 0ms;
- cumulative layout shift is 0;
- the route exposes no per-frame animation of `filter`, `backdrop-filter`,
  layout properties, or an inherited transition custom property.

A separate fixed-window trace should report main-thread style/layout, paint,
and raster duration for the exact provider transition. The candidate must not
contain any individual main-thread task at or above 8.33ms attributable to
provider-route mount or transition code. Trace collection adds overhead, so
this result is diagnostic architecture evidence rather than a literal refresh
rate measurement.

These automated gates establish 120Hz readiness, not 120fps proof. Final 120Hz
acceptance requires the physical iPhone Safari and installed PWA path, with no
visible hitch during repeated cold and warm provider transitions.

## Test Strategy

Follow test-driven development:

1. Add source/integration assertions for the compact picker, grouped labeled
   fields, sticky action region, native selection semantics, and absence of
   the former tall preset-row structure on the configure path. Run them red.
2. Add navigation motion assertions that reject animated filters and require
   the dedicated opacity layer, including edge-back and reduced-motion parity.
   Run them red.
3. Add the real-click provider transition browser regression with the budgets
   above. Capture the current baseline before product changes.
4. Implement the smallest structural and CSS changes that satisfy the visual
   contract, then replace the navigation filter path with the compositor-safe
   overlay.
5. Run focused tests green, full Vitest, full ESLint, production build, both
   mobile browser profiles, theme screenshots, 200% text, keyboard/focus, and
   Impeccable detection.

Any failed performance sample is retained and reported. Thresholds are not
relaxed after observing candidate results, and failed samples are not silently
replaced by reruns.

## Non-Goals

- No provider protocol, URL, path, model, storage, API, or backup semantics
  change.
- No automatic model refresh or provider auto-detection.
- No new dependency, logo download, remote asset, onboarding flow, or wizard.
- No redesign of unrelated settings, reader, Library, or Reading surfaces.
- No claim of physical 120fps from Chromium emulation.
- No merge to `main` or production deployment without fresh explicit user
  authorization.
