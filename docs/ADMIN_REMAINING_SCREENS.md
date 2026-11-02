# Remaining admin screen redesigns

## Data Requests — D57

`feat/admin-data-requests-workspace` redesigns the existing privacy queue with open-first status filtering, search/type filters, three actionable queue counts, full-filtered-result sorting before ten-row pagination, and equivalent mobile sort controls. Review uses the existing centered AdminDialog with busy dismissal protection and focus restoration. It shows the subject, request text, processor/resolved time and a two-step action/resolution composition. Closed requests are readable with disabled actions. Completion/rejection require a note; completion requires an explicitly recorded action. Erasure still requires a separate confirmation and reason; unavailable account details disable profile mutation controls.

Services, rules, routes and stored fields are unchanged. Existing data-request audit hooks remain best-effort. UI read-only/transition checks are not a new server-side guarantee. No production account was changed and no Hosting deployment is included. FR-039/NFR-19 remain partial pending production end-to-end validation.

Validation: frontend build/docs checks pass. Isolated fictional-data checks cover export/completion guards, closed/disabled actions, correction, erasure confirmation/reason, load/save retry, both date-sort directions before pagination, Escape dismissal, light/dark and 390/768/1024/1440px with no page overflow. The phone dialog fits at 354px in a 390px viewport. No service/rules code changed. Verify live processing under an appropriate administrator session before release.

## Dashboard — D58

`feat/admin-dashboard-overview` replaces the navigation-only dashboard with current privacy-open, Active-profile and hospital-staff-profile counts, the three oldest open privacy requests, current configuration values and direct workspace links. Counts are explicitly profiles rather than unique facilities. Each of the three existing services loads independently; a failed source is unavailable rather than zero. Snapshot time is a client refresh timestamp, not a server synchronization guarantee. No new collection, aggregate write, permission, invented trend or provider-delivery statistic is added.

Motion is limited to a small decorative care symbol with reduced-motion support. Verify live role-gated reads before production release; this batch does not alter the service layer or deploy Hosting.

Dashboard validation: build/docs checks pass; fictional fixtures verify exact counts (18 open / 15 Active / six hospital-staff profiles), oldest-first priority order, empty zeros versus failed-source dashes, independent-source retry, dark mode and 390/768/1024/1440px without page overflow. The public care logo asset is served by the existing Vite assets configuration.
