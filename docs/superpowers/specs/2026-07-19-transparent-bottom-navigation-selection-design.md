# Transparent Bottom Navigation Selection Design

## Summary

Replace the root navigation's solid violet 31px selection backing with a
theme-aware translucent pill that occupies most of one tab region. Preserve
the existing frosted navigation capsule, tab layout, destinations, touch
targets, semantics, and transform-only motion architecture.

The approved visual reference is the user's second screenshot: the selected
destination sits on a quiet translucent rounded material rather than an
opaque colored square. The reference's blue content color is not part of this
change. Light and Sepia use a black selected icon, Dark and system-dark use a
white selected icon, and label colors remain on the current theme rules.

## Goals

- Remove the opaque violet square and its violet shadow.
- Make the selected backing read as a translucent, low-contrast rounded pill.
- Expand the backing from icon-sized to nearly the width and height of one tab
  region, matching the supplied reference hierarchy.
- Keep the active icon black in Light and Sepia, and white in Dark and
  system-dark so it retains sufficient contrast.
- Keep the active and inactive label color behavior unchanged.
- Preserve the persistent 420ms indicator tween, rapid retargeting, and
  reduced-motion behavior.
- Keep the animation compositor-friendly and suitable for a physical iPhone
  120Hz target.

## Non-goals

- Do not change the navigation capsule's 302px width cap, 76px height, 33px
  radius, safe-area offset, blur, border, or shadow.
- Do not change the Library, Reading, or Settings icons, labels, destinations,
  handlers, order, focus semantics, or 44px minimum touch targets.
- Do not introduce blue or violet active content colors.
- Do not change root-page transitions or any persisted application state.
- Do not claim that Chromium mobile emulation proves physical 120fps.
- Do not deploy to production without separate user authorization.

## Visual Design

The single persistent indicator continues to align to one of the three equal
tab regions. Its visible pseudo-element changes from a centered 31px square to
a near-full-region pill:

- 60px high within the 76px navigation capsule, positioned 8px from its top;
- the complete equal tab-region width with a 4px inset on each side, leaving
  an 8px visual gap between adjacent selection positions;
- a 30px radius, exactly half its height;
- no violet fill, violet shadow, independent blur, or animated material
  property.

The backing uses a static theme token:

- Light: `rgba(118, 118, 128, 0.12)` over the existing white frosted material;
- Sepia: `rgba(130, 105, 66, 0.14)` over the existing cream material;
- Dark and system-dark: `rgba(255, 255, 255, 0.12)` over the existing dark
  frosted surface.

The backing is intentionally visible as a soft material region, not as a
border-only outline. It remains translucent enough for the parent navigation
material to read through it.

Selected content behavior remains restrained:

- Light and Sepia selected icons are `#000000`.
- Dark and system-dark selected icons are `#ffffff`.
- Active labels retain the current `var(--text-primary)` behavior and existing
  weight; inactive labels retain `var(--root-tab-content)`.
- Existing selected icon and label micro-lift behavior remains unchanged.

## Architecture

`AppNavigation` continues to render exactly one `.tabIndicator`. Motion still
updates only its `x` transform using the existing `ROOT_TAB_TRANSITION`:

- duration: 420ms;
- easing: `[0.22, 1, 0.36, 1]`;
- rapid taps retarget the live transform;
- reduced motion uses zero duration.

No React state, additional indicator nodes, layout measurements, or animation
listeners are added. The implementation is limited to navigation theme tokens,
indicator CSS, and assertions that describe the new visual contract.

The indicator's translucent fill, dimensions, radius, and any static edge
treatment do not animate. The navigation's `backdrop-filter` remains on the
stationary parent capsule. The moving indicator must not add its own blur or
animate `filter`, `backdrop-filter`, background, border, shadow, width, height,
top, or left.

## 120Hz Performance Contract

The product target is smooth motion on physical 120Hz iPhone displays. The
implementation supports that target by keeping the active movement to a single
compositor transform and avoiding per-frame layout, paint-heavy filters, and
node replacement.

Automated browser verification must continue to require:

- one persistent indicator;
- transform retargeting during rapid tab changes;
- no layout shift;
- no 50ms-or-greater long task during the root-tab probe;
- reduced motion with no running indicator animation.

The existing Chromium profiles are stable 60Hz smoke evidence. They cannot
establish physical 120fps. A real iPhone Safari or installed-PWA trace remains
the acceptance source for a literal 120Hz claim.

## Accessibility and Theme Behavior

`aria-current="page"`, the navigation label, native buttons, focus treatment,
and touch-target dimensions remain unchanged. The selected state continues to
be communicated by material, icon contrast, label weight, and semantics rather
than color alone.

Theme coverage includes Light, Sepia, explicit Dark, and system-dark without
an explicit reader-theme override. Black is not used for selected icons on a
dark material; the approved white exception preserves visibility.

## Testing

Implementation follows test-driven development:

1. Update the focused navigation contract test so the current violet square
   fails against the new full-region translucent-pill requirements.
2. Add theme-token assertions for neutral translucent active fills and
   black/white selected-icon behavior.
3. Update browser geometry and computed-style assertions to reject the 31px
   violet backing and validate the larger rounded translucent material.
4. Keep the existing rapid-retargeting, reduced-motion, semantics, safe-area,
   and performance assertions.
5. Capture and inspect Library, Reading, and Settings states across Light,
   Sepia, Dark, and system-dark at both configured iPhone viewport sizes.
6. Run focused Vitest, the full configured lint and build, both iPhone
   native-navigation Playwright projects, and `git diff --check`.

## Acceptance Criteria

- No opaque purple selection square or purple indicator shadow remains.
- The selected backing is a large translucent pill aligned to exactly one tab
  region and never overlaps adjacent content.
- Light and Sepia selected icons compute to black; Dark and system-dark
  selected icons compute to white.
- Label colors are unchanged from the current theme behavior.
- All three destinations and their focus, semantics, and touch targets remain
  functional.
- The indicator continues to use the 420ms transform tween, retargets rapidly,
  and becomes immediate under reduced motion.
- Browser performance evidence reports no layout shift or long task, with the
  physical 120Hz validation caveat recorded rather than overstated.
