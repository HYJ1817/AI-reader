# Reading Data Reliability Design

**Date:** 2026-07-22

## Goal

Prevent stale reader sessions from overwriting restored backups, preserve the
last TXT/EPUB position across close/background/switch events, and apply three
low-cost safeguards for backup imports, Service Worker cache cleanup, and
Gemini credentials.

## Scope

This change includes:

- one coordinated pending-position API for TXT and EPUB readers;
- distinct flush and cancel semantics;
- a backup-restore lock and safe restore ordering;
- immediate EPUB mode snapshots;
- a 500 MiB backup import limit checked before reading the file;
- cache cleanup restricted to `ai-reader-*` entries; and
- Gemini API keys sent with `x-goog-api-key` rather than in the URL.

The existing metadata-only library loading remains the damaged-book isolation
boundary. This change adds regression coverage but does not add a repair wizard,
ZIP backups, encoding detection, accounts, rate limiting, or deeper EPUB scans.

## Architecture

### Pending position coordinator

Add a small reader-position coordinator with explicit operations:

- `schedule(position)`: replace the pending snapshot and debounce persistence;
- `flush()`: clear the timer, take the pending snapshot, and await its write;
- `cancel()`: clear the timer and discard the pending snapshot; and
- `setBlocked(blocked)`: reject scheduled or direct stale-session writes while
  backup restoration owns the database.

The coordinator owns ordering so an older async write cannot finish after a
newer flush and overwrite it. Writes for different books retain their book IDs,
but switching books flushes the previous book before presenting the next one.

TXT scrolling schedules snapshots through the coordinator. EPUB relocation
schedules snapshots through the same contract instead of maintaining an
independent fire-and-forget timer inside `EpubReader`.

### Lifecycle behavior

Normal lifecycle exits preserve data:

- reader close;
- book switch;
- `visibilitychange` to hidden;
- `pagehide`; and
- application-triggered version reload preparation.

These paths call `flush()` and await it where navigation ordering permits.
Browser lifecycle events cannot guarantee that asynchronous IndexedDB work
finishes on iOS, but starting the write immediately is the strongest available
best effort and removes the current 180 ms delay.

Backup replacement intentionally discards old session state. It sets the
restore lock, blocks new reader writes, cancels pending progress, closes and
clears the reader, then restores the validated backup. The lock stays active
until metadata, progress, groups, reading statistics, background, and settings
have been reloaded. Normal persistence resumes only afterward.

### EPUB mode changes

Before changing the mode, capture the current EPUB snapshot. Persist its
locator and progress with the new mode immediately. Cancel any old-mode pending
snapshot before the old rendition tears down, so its cleanup cannot overwrite
the new mode. Subsequent relocation events may refine the locator while keeping
the new mode.

### Backup size protection

Export format remains JSON + Base64. Import rejects a file larger than
`500 * 1024 * 1024` bytes before calling `file.text()` or `JSON.parse()`. The UI
shows a dedicated Chinese error explaining that the file exceeds the 500MB
device-safety limit. Invalid payload validation continues to occur before the
transactional database replacement.

### Low-cost security and cache safeguards

Service Worker activation deletes only cache names that start with
`ai-reader-` and are not the current cache. Other same-origin caches remain
untouched.

Gemini requests remove the `?key=` query parameter and add the API key to the
`x-goog-api-key` header. The request body, endpoint path, and other provider
protocols remain unchanged.

## Error handling

- A failed flush remains observable to the caller where it can be awaited; a
  later snapshot is not silently replaced by an older one.
- Restore failures release the lock in `finally` and retain the existing error
  presentation.
- The 500MB limit fails before allocating the backup text or decoded payload.
- Missing individual source records continue to leave the library usable and
  report the existing read error when that book is opened.

## Testing

Unit and integration tests will cover:

- debounce replacement, ordered flush, cancel, and blocked writes;
- restore ordering and rejection of stale writes;
- close, switch, hidden, and `pagehide` wiring;
- EPUB mode snapshots using the new mode;
- the 500 MiB boundary without allocating a large file;
- Service Worker prefix-only deletion;
- Gemini URL/header construction; and
- metadata listing when one source record is missing.

Final gates are the full Vitest suite, ESLint, production webpack build, and
focused iPhone 14 Playwright flows. Publication updates the existing feature
branch and draft PR, then deploys the verified product commit to the existing
Cloudflare Worker. Production verification must preserve any observed failure
without retrying it away.

## Acceptance boundaries

Automated browser checks cannot prove that iOS will always finish IndexedDB
writes after suspension or demonstrate physical 120Hz behavior. Final physical
iPhone/PWA checks remain: immediate TXT/EPUB close, background/resume, EPUB mode
switch, rapid book switch, and restore while an old session has pending state.
