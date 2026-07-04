# Collection Active Affordance Plan

## Objective

Make the currently active collection row in Library read as a selected
navigation destination, while keeping row layout, filtering behavior, and
collection management untouched.

## Steps

1. Add focused motion CSS coverage before implementation:
   - `.collectionRow` transitions background, box-shadow, and transform.
   - `.collectionRowIcon` and `.collectionRowChevron` transition color and
     transform.
   - `.collectionRowActive` has a stronger non-layout selected affordance.
   - active icon scales to `1.04`.
   - active chevron translates `2px`.
   - reduced motion disables collection active transitions and transforms.
2. Run the focused motion CSS test and confirm it fails for the missing active
   affordance.
3. Update `app/page.module.css`:
   - add an inert box-shadow baseline to `.collectionRow`;
   - add inset selected highlight and subtle top shine to `.collectionRowActive`;
   - add transform/color transitions to icon and chevron;
   - tint and scale active icon;
   - tint and nudge active chevron;
   - add reduced-motion coverage for the new active affordance.
4. Re-run the focused test and then full verification:
   - `npm.cmd run test -- lib/motionCss.test.ts`
   - `npm.cmd run test`
   - `npm.cmd exec -- eslint app lib`
   - `npm.cmd run build`
   - `git diff --check`
5. Commit the implementation, refresh `HANDOFF.md`, push, and verify PR checks.
