# Immediate 25 km matching

On 2026-11-04 the owner replaces timed radius expansion with full 25 km coverage
from the first search (D89). The live `dugo-plus-clean` configuration was changed
at 13:37:18 Philippine time using an update-time precondition:

```json
{"radiusTiers":[{"tierOrder":1,"radiusKm":25,"waitMinutes":10}]}
```

This uses the existing deployed matcher. One final tier means `nextTierAt` is
null, `exhausted` is true, and open requests continue rescanning 25 km each
scheduled cycle. The stored wait value is unused. This includes donors inside
5 km; 5 km is not a minimum distance. Existing request pins remain their saved
creation-time locations; changing the facility pin does not rewrite old requests.

Only radiusTiers and the server updatedAt timestamp were changed. Notification
retry settings, access rules, eligibility and blood/component compatibility
remain unchanged. No Worker/Hosting deployment or data migration is required.
The schema remains configurable; historical seed/fallback values are retained.
A fresh project must apply this documented production override rather than rely
on the old staged defaults. Re-running the seed without --force preserves the
existing production document.

Live follow-up verified one new match on the next cycle at 13:38:07, with the
notification marked Sent at 13:38:14. The previous radius excluded this eligible
donor at 5.51 km. Provider Sent status does not prove inbox receipt. An older
request retains a different pin, 42.26 km from the same donor, outside 25 km.

## Explicit wider search (D90)

The owner confirms that 25–50 km requests appear only when a donor widens search,
without automatic alerts outside 25 km. `POST /donor/discover` uses token identity
and an Active donor profile, considers open requests using the saved profile
location and the same compatibility/age/interval selection as automatic matching,
and creates only that donor’s deterministic matches through create-only writes.
No notification fan-out runs. Existing responses/consents and donation records
are preserved. Subsequent acceptance uses the existing server checks.

The UI requests discovery only for 50 km/Any matched distance, with loading,
error and explicit retry. The ordinary 25 km filter hides farther matches.
Read traversal is bounded to 1000 requests; oversized searches fail before
writes rather than silently truncate. Up to 400 candidate writes are allowed.
There is no polling. No new collection, field, index or rules permission is added.
Worker deployment must precede Hosting. Historical database configuration
remains tunable; the production override above persists independently of deploys.

Validation: 153 unit/regression checks pass, including 4 new discovery checks
covering distance, compatibility, closed/self requests, active/erased/role access,
age/deferral, and explicit radius input. Vite and Worker bundles compile.
Live wider-search browser/provider verification is recorded in the release
output; requirements remain partial rather than claiming broad certification.
