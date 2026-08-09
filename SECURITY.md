# Security Policy

## Supported versions

Security fixes are applied to the latest code on `main` and, when practical,
to the latest published release. Older releases are not maintained separately.

## Reporting a vulnerability

Please use GitHub's private **Report a vulnerability** flow in the repository's
Security tab. Do not open a public issue for credentials, private book content,
backup data, or an exploit that has not been fixed.

Include the affected version or commit, reproduction steps, impact, and any
suggested mitigation. Remove API keys, book text, IndexedDB exports, and other
personal data from screenshots or logs.

The maintainer will acknowledge the report through the private advisory,
investigate it, and coordinate disclosure after a fix is available. This
project does not promise a fixed response or release schedule.

## Security boundaries

AI Reader is local-first, but configured AI requests send the selected context
to the provider chosen by the user. Reports about provider privacy, browser
storage, backup import, service-worker caching, or deployment configuration are
in scope when they affect this repository.
