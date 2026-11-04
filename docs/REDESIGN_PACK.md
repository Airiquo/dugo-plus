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

## Screen 02 — Donation history

The toolbar and history span the content width, with the existing readiness and
summary panels retained below rather than reducing search/export space. The empty
state groups an SVG blood-drop tile, heading, explanation and matched-request
action. Existing record details, sort/filter/export callbacks and eligibility
logic remain. Browser layout checks cover 1440/390/320 light/dark and the empty
state; compiled output/build/docs/whitespace checks pass.

## Screen 04 — Request detail drawer

The existing right-side native drawer retains outcome, dates, original details,
reply, rejection reason and action. Request ID has a full-value Copy action with
visible failure feedback and truncation; missing actions read Not recorded. No
claim that no data was shared is inferred. The page-level privacy composition
remains unchanged pending the owner answer.

## Resolved owner answers and shared exports

Keep the form/history privacy composition and tidy only history. Add This page
only while retaining all existing export scopes. Use Download CSV and Print PDF
inside Export, never as separate toolbar buttons. Shared exports now receive an
explicit displayed-page callback at all 13 report declarations. Page scope uses
only rendered records, without cursor traversal; complete scopes retain existing
callbacks and authorization. The directory also retains All pages / Clear filters.
Both formats use the same chosen scope, and the native radio group supports
arrow-key selection. No unresolved product question remains for these choices.

## Screen 05 — Admin account directory

One toolbar groups search, account type, access status, blood group, joined-date
overlay and Export. New presentation filters operate on the already-loaded
authorized account collection; joined dates use the existing PHT-inclusive filter
helper. Existing columns, sorting, account actions, provisioning and account-history
controls remain. Meta text states showing/loaded counts and date timezone.
