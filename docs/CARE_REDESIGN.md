# Care redesign — 2026-11-01

## Direction and scope

| Item | Applied result |
| --- | --- |
| Owner direction | Branch from `integration`; apply the approved light landing design and motifs across the app; donor desktop and mobile responsiveness. Owner permits redesign and asks only design questions to be escalated. |
| Branch base | `codex/light-care-redesign`, started from `origin/integration` at `d5f8028`, then fast-forwarded to the updated `integration` at `d173b7b` before committing. Isolated worktree: `/Users/pol/Documents/dugo_mobile_web-care-redesign`. |
| Reference | Existing approved landing at `dugo-opencode-hospital/dugo-landing-react`, source commit `f2b3394767f185fab32ca6d5bf236d9377d8e6eb`. |
| Theme | Light on first visit; manual dark choice retained under `dugo-care-theme`. This deliberately supersedes the old OS-driven default. |
| Styling | App-owned `web/src/styles/app.css`; shared `styles/dugo.css` and `styles/dugo.extras.css` untouched. Scoped landing utilities reproduce the reference without adding a Tailwind build dependency. |
| Data boundary | Firebase configuration gate, auth chain, role guards, services, rules, matching and consent writes preserved. No fixture route, alternate login or demo mode ships. |
| Scope boundary | Existing functional screens receive shared styling. History/rewards/tracker, inventory and screening workflows remain at their existing requirement status. Admin dashboard links to built administrative tools; legacy stub route URLs remain available. |
| Copy correction | Removed “One account, three roles” from login, password recovery and verification; each has relevant care/account copy. Auth grid no longer flex-grows beyond its centered container. |

## Tokens and layout blueprint

| Concept | Exact applied value |
| --- | --- |
| Light page / panel / field | `#F9F8FF` / `#FFFFFF` / `#F9F8FF` |
| Light text / muted | `#01373D` / `#536C70` |
| Light crimson / border | `#CE1A4D` / `#D3CCFF` |
| Light blush / blue wash | `#F8E4E5` / `#EAF1FF` |
| Typography | DM Sans; large display headings use weight `300`, body uses existing sans scale. Self-hosted font files. |
| Radii / control height | `20px` panel, `12px` small panel, `48px` controls; pill-shaped primary buttons. |
| Auth desktop container | `min(1184px, calc(100% - 96px))`, centered; columns `1.1fr .9fr`, gap `88px`. At 1440px, side margins `128px`. Band `display:block`; grid `flex:none`. |
| Donor desktop container | `min(1248px, calc(100% - 96px))`; profile form plus `340px` donor summary, `32px` gap. |
| Responsive breakpoints | `1100px`: tighter spacing; `900px`: donor profile/map/privacy stack and staff navigation reflows; `700px`: one-column auth/forms, fixed donor bottom navigation, `20px` content gutters. |
| Phone safe area | Bottom navigation respects `env(safe-area-inset-bottom)`; donor main reserves `120px` plus safe area. |
| Motion | Section reveals, hover-pausing ribbons, scroll-driven phases/glowing lines, address magnifier; Connected by care logo fills solid crimson bottom-up in `4s`, then pulses once and stays full. Shared app headings enter gently; decorative rings animate without moving inputs. Reduced-motion CSS removes these effects. |

## Screen and section outline

| Route / section | Structure and source | Requirement trace |
| --- | --- | --- |
| `/` | Floating navigation → donation-photo hero → scrolling news → illustrative metrics/reviews → Connected by care → Our platform → address transparency → compact giving phases → illustrative hospitals → compatibility → community → FAQ → CTA/footer. | Supporting F1/F3/F4/F7/F9 information; NFR-20, NFR-28. Public copy is not evidence that unbuilt workflows are complete. |
| `/news/:slug` | Source-attributed brief, representative image/credit, source links, related stories; 10 local article routes. | Supporting public education, NFR-20. |
| `/login`, `/register`, `/forgot-password`, `/verify-email`, `/partner` | Shared floating navigation, bounded two-column care introduction/photo and existing form; one column on phones. | FR-01/02/048, NFR-12/13/20/21; partner intake supports FR-040. |
| `/home` | Care page heading → editable profile + derived donor summary. Fields, validation, location, dirty/save states retained. | FR-04/010, NFR-20/28. |
| `/donor/requests` | Page heading → compact filters → request list beside map on desktop, stacked map/list on phones → bounded consent response dialog. | FR-005/006/022/023/028/029/030/038; NFR-28. |
| `/donor/alerts` | Care introduction, notification list and loading/empty/error states; mobile bottom navigation. | FR-007, NFR-09/28. |
| `/donor/privacy` | Care introduction, request form and status history side by side or stacked. | FR-039, NFR-19/28. |
| `/admin/dashboard` and built admin routes | Light navigation shell; dashboard launch cards for accounts, data requests, audit and settings. No clinical work or fabricated live KPI counts. Shared forms/tables carry the palette. | FR-035/039/040/041/044/046/047, NFR-29. |
| `/hospital/requests*` | Light staff shell, request-status tabs/table and existing new-request form. | FR-011/012/016/037, NFR-29. |

## Asset provenance and truthful presentation

| Asset/content | Treatment |
| --- | --- |
| Hero | Owner-supplied `pexels-tahir-37553387.jpg`, copied as `assets/care/hero-donating-blood-pexels.jpg`. |
| Logo | Existing owner-provided Dugo+ symbol, self-hosted `assets/care/dugo-mark.png`. |
| Hospital / medical imagery | Retained self-hosted reference assets. News image credits and source URLs in `utils/landingNews.js`; hospital-specific credit/representative labels in `utils/landingContent.js`. No Biofarma photographs copied. |
| Fonts | DM Sans files retained with `assets/care/DM-Sans-OFL.txt`. |
| Metrics, ratings, hospital statuses | Explicit illustrative/sample labels remain visible; not connected to Firestore or presented as verified endorsements. |
| News | Existing source-attributed summaries retained, including source limitations and the 2021 Naga archive label. No new medical eligibility rules introduced. |

## Verification record

| Check | Actual result / limit |
| --- | --- |
| Production compilation | `cd web && npm run build` passes. Existing all-routes bundle still triggers Vite's >500kB chunk advisory; performance targets are not certified. Compiled CSS, route strings and care image/font assets checked in `web/dist`. |
| Existing automated tests | `npm run test:matching`: 35 passed, 0 failed. |
| Documentation check | `node tools/check-docs.mjs` passes. |
| Configured real app | Actual signed-out landing, local Sign In CTA, local news card → article, mobile menu/hash navigation and auth layout observed. Empty login shows both field errors; email-only shows password error. No valid credential submission performed. |
| Missing configuration | Second actual app instance with all six Firebase variables empty: visiting `/donor/requests` shows NotConfigured, not the donor UI. Environment files unchanged. |
| Donor responsive UI | Actual production components rendered in an external, temporary Vite fixture harness at 1440, 768, 390 and 360px. Profile, requests, alerts and privacy each had `scrollWidth === clientWidth` (16 checks). Phone bottom nav fixed; tablet/desktop nav in header. |
| Profile UI paths | Fixture data: empty name → field validation; corrected name/city → save feedback and disabled Saved state. Simulated failed profile load blocks saving and shows unavailable summary rather than endless loading. |
| Requests UI paths | Fixture data: mobile map/list and expanded map tiles rendered; no acknowledgement → error; acknowledgement alone → both-consents error; all three selected → Accepted and directions. This does not verify live consent writes, matching or location sharing. |
| Privacy UI paths | Fixture data: empty details → field error; completed request → status/history entry. Initial empty history also observed. |
| Alerts UI states | Populated, empty and simulated subscription-error states observed with fixtures. |
| Staff UI | Actual admin dashboard shell/launch cards, populated hospital request table and new-request form inspected at desktop width with fixture data. Other staff pages inherit shared tokens; their live journeys were not re-tested. |
| Dark theme | Donor profile manually toggled dark then light; text, fields, summary and navigation remained readable. Reduced-motion behavior checked in source/compiled CSS, not via a device OS preference change. |
| Screenshots | Local proof under `/private/tmp/dugo-care-proof/`: `sign-in-desktop.png`, `donor-desktop.png`, `donor-mobile.png`, `admin-desktop.png`. Fixture screenshots display an explicit fixture banner. |
| Live verification still required | Real donor sign-in, reload/persistence, verified/unverified email journeys, live matching/consent/privacy writes, real Android/iOS Safari/Chrome and complete staff journeys. No credentials available; these checks are not inferred from fixtures. |
| Delivery | Local feature branch only. No merge, remote push, Firebase rules/hosting deployment or modification of the previously published reference Site. |
