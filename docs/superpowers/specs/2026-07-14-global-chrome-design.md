# Global Chrome and Navigation Scale Design

**Status:** Approved for inline execution on 2026-07-14 under the user's standing authorization to continue without intermediate confirmation.

## Goal

Make the three persistent root destinations feel quieter and more native on an iPhone by reducing oversized headings, floating-tab bulk, capsule emphasis, highlights, and shadows while preserving navigation reliability and accessible touch geometry.

## Observed Problem

The current production screenshots show a 40px/800 root title and a 72px floating tab bar. The active destination is represented by a full-width inner capsule with its own highlight and shadow, while the outer bar adds another highlight and shadow. This creates three competing layers of chrome around content that is already visually dense.

The behavior is sound: all three roots stay mounted, the shared Motion indicator moves on the compositor, Back/history and focus restoration work, and every tab is easy to tap. Phase 2 must therefore change presentation and semantics without changing the navigation model.

## Approved Direction

### Root headings

- Use a 34px, 750-weight root title with a 1.1 line height.
- Keep the existing safe-area top inset and root layout structure.
- Do not redesign section content, cards, library hierarchy, or reading-dashboard information architecture in this phase.

### Bottom navigation

- Introduce shared root-navigation dimension tokens: 60px bar height and 8px bottom offset above the safe area.
- Keep the outer bar floating, but use a restrained 22px radius, one hairline, a softer 2px/8px shadow, and no decorative top glint.
- Use 24px icons and 11px labels inside a minimum 44px button target.
- Replace the full active capsule with a shared moving indicator track whose only visible material is a centered 24px by 2px tint line.
- Use tint color, icon fill/stroke, label weight, and `aria-current="page"` together for the active state. The state must not rely on the line or color alone.
- Keep the existing shared Motion element, spring, tab order, press response, reduced-motion behavior, and one click handler per destination.

### Content clearance and selection bar

- Derive root content bottom padding and the library batch-bar offset from the new navigation tokens.
- Preserve safe-area calculations and ensure content and the batch bar never sit behind the navigation bar.

### Header actions

- Preserve current edit/import actions and their order.
- Normalize the existing root-header action controls to at least 44px high; visual compaction must never shrink their hit target.

## Non-goals

- No route, label, destination, history, root-mount, reader-presentation, or gesture changes.
- No library-card, reading-dashboard, settings-list, reader-chrome, or sheet redesign.
- No new blur system, gradient, decorative animation, or new component state.
- No speculative EPUB ambient changes.

## Verification

- Source-level tests lock the title scale, tokenized safe-area offsets, 60px navigation height, 44px targets, quiet material, active semantics, and non-capsule indicator.
- Browser tests check computed geometry, one `aria-current="page"` destination, state changes, root preservation, and screenshots on iPhone 14 and iPhone 15 Pro Max.
- Existing motion/navigation tests must remain green, followed by the full repository gate and production verification.

## Acceptance Criteria

- Root titles no longer dominate the first viewport.
- The bottom navigation reads as one light system surface rather than nested floating capsules.
- All tab and root-header actions retain at least 44px targets.
- Active destination remains immediately clear through semantics, tint, weight, icon treatment, and the small moving line.
- Root state, focus restoration, Back behavior, reduced motion, reader presentation, and frame cadence are unchanged.

