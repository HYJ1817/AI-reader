# iOS Reader UI Design

## Goal

Make the PWA feel closer to the iPhone Books app while keeping the existing local-first reader behavior intact.

## Screens In Scope

- Library page
- Collections page
- Bottom navigation
- Reader chrome
- AI provider sheet visual polish only if affected by shared list/sheet styles

## Visual Direction

- Use quiet native iOS hierarchy: large title, plain list rows, hairline separators, direct navigation, minimal ornament.
- Avoid decorative dashboard cards, colored icon boxes, nested cards, heavy shadows, and marketing-style stats.
- System collections and custom collections use simple line icons directly on the list row. No icon border box and no colored square background.
- The library "藏书" entry is a plain row with only top and bottom hairline separators, not a rounded card.
- Bottom navigation is a floating liquid-glass capsule. It uses three app tabs only: 书库, 阅读, 设置. Icons are larger and heavier, labels are short, the active item has a soft rounded highlight inside the capsule.
- Light mode should be the default when system is light. Dark mode should be restrained, not pitch-black unless the system or reader theme requires it.

## Interaction Constraints

- Do not change AI provider data model, chat request payload behavior, book storage, backup format, or EPUB/TXT parsing.
- Do not send full book content to AI.
- Keep reading vertical scroll behavior and reliable reader chrome tap behavior.
- Keep the current three bottom tabs.

## Verification

- Library page shows a simple iOS-like list, not a dashboard.
- Collections page has line icons without colored icon boxes.
- Bottom navigation visually resembles a floating iOS glass capsule.
- Existing import, open book, ask AI, provider settings, grouping, and reading progress still work.
