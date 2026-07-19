# Reference Bottom Navigation Design

Date: 2026-07-19

## Goal

Redesign the root `书库 / 阅读 / 设置` navigation to match the user's compact
floating-pill reference while preserving the existing typed navigation model,
history behavior, mounted root surfaces, and visibility rules.

The visual result must feel quiet and native to AI Reader: one centered
theme-aware material, three large targets, and one precise violet selection
marker. This is a chrome-only change. It does not redesign the three root
screens or the reader controls.

## Approved References and Decisions

The user supplied two visual references:

- A cropped mobile bottom navigation with a compact dark pill, three stacked
  icon-and-label destinations, and a violet rounded-square icon backing for the
  selected destination.
- A solid eight-tooth gear with a circular center cutout for Settings.

The approved decisions are:

- Preserve the reference geometry and active-icon treatment.
- Keep `书库 / 阅读 / 设置` and their existing behavior.
- Replace the Settings sliders icon with a solid eight-tooth gear.
- Let the navigation material follow the Light, Sepia, and Dark appearances.
- Use a theme-aware frosted material rather than a solid or decoratively tinted
  material.
- Keep the selected icon backing violet in every appearance.
- Slow the selection movement to 420 ms.
- Design the moving path for 120 Hz-capable devices without claiming that a
  browser can guarantee 120 frames per second on every device.

## Geometry

The root navigation is a centered fixed pill:

- Width: `min(302px, calc(100vw - 32px))`.
- Height: `76px`.
- Corner radius: `33px`.
- Horizontal position: `left: 50%` with `translateX(-50%)`; do not keep the
  current full-width `left: 16px; right: 16px` layout.
- Bottom position: `calc(var(--safe-bottom) + 8px)`.
- Internal padding: `3px 16px 5px` with `box-sizing: border-box`.
- Each destination owns an equal third of the usable width and a minimum
  `44px` by `44px` interactive area.
- Icon size: `21px` inside a `31px` by `31px` active backing.
- Icon-to-label gap: `3px`.
- Label size: the existing `--type-caption` token with a compact `1` line
  height and medium-to-semibold weight.

`--root-tab-height` becomes `76px`. Existing root-surface bottom padding must
continue to derive from this token so content is never hidden behind the wider
safe-area-aware chrome.

## Theme-Aware Frosted Material

The bar keeps one geometry in every appearance and changes only its material
tokens. Add root-tab-specific tokens rather than changing global sheet or
overlay tokens used elsewhere:

| Appearance | Navigation fill | Border | Inactive content |
| --- | --- | --- | --- |
| Light | `rgba(255, 255, 255, 0.68)` | light separator mix | dark tertiary text |
| Sepia | `rgba(244, 236, 216, 0.68)` | sepia separator mix | sepia tertiary text |
| Dark | `rgba(44, 44, 46, 0.72)` | light-on-dark separator mix | light muted text |

The material uses a static `14px` backdrop blur with light saturation. Blur,
fill, border, and shadow do not animate during tab changes. Use a restrained
theme-aware shadow with no more than 8 px blur. Use a 0.5 px material boundary;
do not pair it with a wide decorative shadow.

The selected backing uses one navigation-specific accent token derived from
the approved reference, `#7d55e7`, with a white icon. It does
not inherit the reader `--tint`, because Sepia's brown tint and Light/Dark's
blue tint would remove the approved violet identity. The selected label uses
the current theme's primary text color. Unselected icons and labels use the
theme's tertiary or muted navigation color.

Contrast must meet at least 3:1 for meaningful icon geometry and 4.5:1 for
labels. If the sampled material behind the blur makes a label fail, strengthen
the theme-specific content token; do not add a text shadow.

## Selection Indicator and Icons

Keep the existing single persistent Motion indicator and its
`layoutId="root-tab-indicator"`. Change its visual payload from the 24 px by
2 px bottom line to a centered `31px` by `31px`, `10px`-radius violet icon
backing in the selected third.

The backing stays behind the selected icon and never spans the full tab item.
The old bottom violet line is removed completely.

The existing Library and Reading icon vocabulary remains. Settings changes to
a solid eight-tooth gear with a clean circular cutout:

- The gear uses one filled SVG path with an even-odd center cutout.
- It must remain recognizable at 21 px without hairline teeth.
- Unselected Settings uses the same muted current color as other inactive
  icons.
- Selected Settings is white over the violet backing.

No external icon package or raster asset is added for this change.

## Motion and Interaction

Tab behavior and click handlers do not change. The indicator is the only
continuously moving element during selection:

- Animate the indicator with `transform` only.
- Use a dedicated root-tab transition token: a zero-bounce 420 ms ease-out
  transform tween. Do not change the shared navigation spring used by page and
  stack transitions.
- Recommended easing: the existing emphasized curve
  `cubic-bezier(0.22, 1, 0.36, 1)`.
- A rapid second selection retargets from the indicator's current rendered
  position. It must not wait for the first transition or create a second
  indicator.
- The active icon translates upward by 1 px and scales to `1.04`.
- Press feedback scales the pressed destination to `0.96` and returns
  immediately on release.
- Reduced motion changes the indicator position immediately and disables icon
  lift and press scaling.

The frosted backdrop, shadow, borders, icon path, and labels remain static
during indicator motion. Do not animate layout properties, backdrop blur,
shadow blur, width, height, left, or bottom. Do not add permanent
`will-change`. Browser compositing should be driven by the active transform;
only one indicator exists in the DOM.

## Accessibility

Preserve:

- `<nav aria-label="主要导航">`.
- `aria-current="page"` on exactly one active destination.
- Existing button handlers and keyboard activation.
- Existing focus-visible treatment, adapted so it is not clipped by the pill.
- A minimum 44 px interactive target for all destinations.
- Existing bottom-tab visibility behavior while the reader, push surfaces, or
  incompatible selection modes are active.

The filled gear is decorative inside the labelled Settings button and remains
`aria-hidden="true"` through the parent SVG convention. Labels remain visible;
the design does not become icon-only.

## Performance Contract

The implementation targets 120 Hz-capable iPhones by keeping the selection
path compositor-friendly:

- One persistent indicator.
- One `transform` animation.
- No React state updates per animation frame.
- No DOM measurement loop.
- No layout-property, filter, blur, or shadow animation.
- No permanent compositor hint.
- Rapid retargeting remains bounded to the same element.

Automated Chromium cannot prove physical 120 Hz rendering. Automated gates
therefore require stable 60 Hz behavior, no 50 ms long task during tab
selection, and no layout shift. A physical 120 Hz iPhone trace remains the
final non-blocking acceptance check, with an ideal per-frame budget of 8.33 ms.

## Integration Boundaries

Primary files expected to change:

- `app/AppNavigation.tsx`: gear path and indicator transition wiring.
- `app/page.module.css`: geometry, theme material, selection backing, icon and
  press states.
- `app/globals.css`: root-tab-specific theme tokens if the tokens belong with
  the existing appearance definitions.
- `lib/navigationChrome.test.ts`: chrome geometry and visual contract.
- Relevant motion and integration tests when their existing assertions refer
  to the old bottom line or height.
- Mobile Playwright coverage for rendered geometry, theme switching, motion,
  rapid retargeting, and reduced motion.

Do not change the typed navigation reducer, browser-history behavior, root
surface mounting, page transition tokens, reader chrome, or batch operation
logic.

## Verification

The implementation is complete only after:

1. Unit/integration tests verify the centered 302 px cap, 76 px height, 33 px
   radius, safe-area offset, removed bottom line, violet backing, and solid gear.
2. Theme tests verify Light, Sepia, and Dark use distinct frosted materials and
   readable content tokens while retaining the violet selected backing.
3. Motion tests verify a dedicated 420 ms transform transition,
   one persistent indicator, no layout/filter animation, rapid retargeting,
   and reduced-motion immediacy.
4. Mobile Playwright on the existing iPhone 14 and iPhone 15 Pro Max profiles
   verifies all three selections, focus semantics, geometry, safe-area
   placement, theme switching, hide/show behavior, and rapid changes.
5. The performance probe verifies no 50 ms long task, no layout shift, and a
   stable 60 Hz frame budget in Chromium. Physical 120 Hz verification is
   recorded as a non-blocking device check rather than represented as an
   automated guarantee.
6. Full Vitest, configured ESLint, production build, and `git diff --check`
   pass.

## Delivery

Implementation commits remain on `codex/custom-background-settings` and are
pushed to the existing pull request. Production deployment is a separate,
explicitly authorized operation.
