# Continue Reading Card Motion Design

## Context

The Reading dashboard now has layered press motion on the today goal card and calmer motion on the seven-day bars. The adjacent "continue reading" card still mostly presses as one flat block, even though it contains three distinct affordances: the book cover, the reading progress track, and the chevron.

## Decision

Polish only the Reading dashboard's continue-reading card. Keep the current card layout, book-opening behavior, import empty state, progress calculation, text, and section spacing.

## Interaction

- The card keeps its existing subtle press scale.
- The book cover inside `.featureBookCard` gains an independent transform baseline and presses slightly down/inward with the card.
- The progress fill gains a transform baseline and transition so progress changes read smoothly.
- The chevron inside `.featureBookCard` nudges right/down on press, matching the goal card's directional affordance without affecting settings rows or other shared chevrons.
- Reduced-motion mode disables the new cover, progress-fill, and chevron transforms/transitions.

## Non-Goals

- Do not change book opening, import, progress calculation, cover loading, or IndexedDB data.
- Do not alter card dimensions, typography, or section ordering.
- Do not add decorative shadows, gradients, or new visual assets.

## Acceptance

- A focused CSS test proves the continue-reading card has cover, progress-fill, and chevron motion targets.
- The focused Reading dashboard CSS test passes after first failing for the new contract.
- The full test suite, ESLint, production build, and whitespace check pass before closeout.
