# Owner-supplied redesign pack

Archive extracted to `/private/tmp/dugo-redesign-instructions-nov04`.
The root and nested `CODEX_PROMPT.md` are identical. All duplicate images have
identical decoded pixels. D84 records implementation on top of `807b72e`.
No screenshot emoji is used; existing SVG icons and real fonts/tokens remain.

## Screen 01 — Find where you can help

Distance, donation type, combined sort and Filters share the main toolbar.
Priority, request status, donor response and dates remain in the existing filter
dialog and apply immediately. Clear filters retains its existing reset behavior.
Distance labels read Within N km. The map stays alongside the list, while the
empty state retains the working 50km action and Alerts inbox destination.

`TODO(design)`: the app has no alert opt-in setting; the existing View alerts link
is retained instead of presenting an action that claims to enable notifications.
No matcher, acceptance, consent, routes or data-layer changes.

Screen 01: build/docs/whitespace checks pass. Browser fixtures checked at
1440/390/320 in light/dark with no page overflow or errors; 1440 screenshot
compared with reference 01. Artifacts: `/private/tmp/dugo-settings-layout-qa/pack-01-*`.

## Pending owner answers

- Privacy: prior form/history composition versus full-width history in the pack.
- Exports: prior existing scopes versus adding This page only.
- Export labels: Print CSV / Print PDF versus Download CSV / Print / PDF.

These block only the conflicting portions; no answer is assumed.
