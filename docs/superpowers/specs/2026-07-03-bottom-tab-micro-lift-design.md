# Bottom Tab Micro-Lift Design

## Goal

Make the bottom navigation feel more tactile by giving the active tab and its
label/icon a subtle shared motion response.

This is the fourth incremental motion polish pass after bottom sheet settling,
reader settings micro-press, and Library book press depth. It targets the
always-visible mobile navigation, where small inconsistencies are felt often.

## Scope

- `app/AppNavigation.tsx`
- `app/page.module.css`
- `lib/motionCss.test.ts`

The existing navigation already exposes:

- `.tabBar` for the fixed bottom bar;
- `.tabIndicator` for active-tab position;
- `.tab` for each button;
- `.tabIcon`, `.tabIconStroke`, and `.tabIconFill` for custom icon motion.

This pass adds a named `.tabLabel` target so text can participate in the same
press/active affordance as the icon.

## Non-Goals

- Do not change navigation destinations.
- Do not change tab order, labels, or visibility logic.
- Do not change tab bar dimensions or fixed positioning.
- Do not introduce JavaScript press state.
- Do not animate blur, filter, or box-shadow.
- Do not change batch action bar behavior.

## Interaction Model

The tab bar already moves the active indicator and scales the whole tab on
press. This pass makes the content feel less static:

- active tab icon gets a tiny upward lift and scale;
- active tab label gets the same tiny upward lift;
- pressing any enabled tab moves the label down and slightly compresses it;
- pressing any enabled tab still compresses the icon, overriding active lift;
- inactive hover remains color-only to avoid noisy desktop motion.

The desired feel is closer to a physical segmented control: active content sits
slightly proud, then the whole target and its contents settle under the finger.

## Motion Protocol

Animated properties:

- `transform`
- existing `color`/`background` where already present
- existing icon fill/stroke properties where already present

Timing:

- `--motion-fast`
- `--ease-standard`

Reduced motion:

- tab icon and label transforms are disabled;
- active lift transforms collapse to none;
- pressed icon and label transforms collapse to none;
- the existing tab indicator navigation motion remains handled by the global
  reduced-motion rules.

## Testing

Update `lib/motionCss.test.ts` before implementation:

- assert `.tabLabel` has compositor-only transform motion;
- assert `.activeTab .tabIcon` and `.activeTab .tabLabel` lift active content;
- assert `.tab:not(:disabled):active .tabLabel` compresses the label;
- assert reduced-motion coverage includes tab icon/label active and pressed
  transforms.

## Acceptance

- Active bottom tabs read as selected before the user touches them, not only
  through color and the sliding indicator.
- Tapping a bottom tab makes icon and text respond together.
- The tab bar footprint and layout do not shift.
- The changes remain compositor-friendly.
- Focused motion tests fail before implementation and pass after it.
- Full tests, lint, build, and whitespace checks pass before push.
