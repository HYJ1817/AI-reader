# Product

## Register

product

## Users

The primary user is a single iPhone reader who imports their own EPUB and TXT books, reads in Safari or a home-screen PWA, and asks AI about selected passages while reading.

## Product Purpose

AI Reader is a local-first personal reading app. It should make importing, reading, progress recovery, local grouping, and selected-text AI questions feel stable enough for daily self-use. Success means the reader can open a book, read comfortably, call up controls when needed, and leave without worrying about losing books or progress.

## Brand Personality

Quiet, native, focused. The interface should feel closer to a restrained iOS utility than a decorative AI product.

## Anti-references

Avoid dashboard-heavy layouts, colorful icon grids, marketing cards, generic AI gradients, and controls that look invented instead of familiar. Do not imitate Apple trademarks or private system APIs.

## Design Principles

- Keep reading as the center: controls appear only when useful and should never push text around.
- Prefer familiar iOS patterns: simple lists, large tap targets, glassy overlays used only for active controls.
- Preserve privacy cues: books and API keys are stored locally by default. AI requests travel through the application interface to the chosen provider with its API key for authentication. Reading questions may include selected passages, nearby visible text, book context and necessary conversation history; explicit or opted-in metadata completion may include bounded opening excerpts. Never send whole books. Automatic AI metadata completion defaults off, and backups exclude API keys.
- Optimize for one-handed iPhone use: safe-area aware controls, large bottom targets, and predictable gestures.

## Accessibility & Inclusion

Use readable contrast in light, dark, and sepia themes. Respect reduced-motion preferences. Keep buttons reachable and labelled for assistive technologies.
