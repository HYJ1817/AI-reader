# Reading Goal Card Motion Design

## Context

The Reading dashboard already has restrained motion on the seven-day bar chart. The "today reading" goal card still moves mostly as one flat block: the card compresses on press, but the circular progress ring and chevron do not express their roles as status and navigation affordances.

## Decision

Polish only the Reading dashboard goal card. Keep the existing compact iOS-like card layout, text, reading-goal behavior, and goal sheet entry point.

## Interaction

- The card keeps its current subtle press scale.
- The circular progress ring gains a transform baseline and presses inward slightly with the card.
- The chevron gains a transform baseline and moves subtly right/down on press.
- The motion uses existing `--motion-fast` and `--ease-standard` tokens.
- Reduced-motion mode disables the new ring and chevron transforms/transitions.

## Non-Goals

- Do not change reading minutes, target calculations, goal editing, labels, card dimensions, or navigation behavior.
- Do not add shadows or decorative gradients to the Reading dashboard card.
- Do not change the seven-day bar chart again in this pass.

## Acceptance

- A focused CSS test proves the goal card has independent ring and chevron motion targets.
- The focused Reading dashboard CSS test passes.
- The full test suite, ESLint, production build, and whitespace check pass before closeout.
