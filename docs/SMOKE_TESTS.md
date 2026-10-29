# Smoke tests — screen by screen

A manual pass over every screen the app has today. It answers one question:
**does the app still work end to end on this commit?** It is not acceptance
testing — requirement completeness lives in `docs/REQUIREMENTS.md`, and a row is
only "tested" when its Status/Notes/evidence move with the run.

There is no test suite. `docs/PHASES.md` §6 holds the four-check minimum; this
file is the full pass for a release, a risky PR, or the first run on a new
machine. Run it against a **staging Firebase project**, not production: several
cases suspend accounts, delete a profile, and write error logs.

## 0. Before you start

| ID | Set up | Passes when |
| --- | --- | --- |
| ENV-1 | `cd web`, `npm ci`, `npm run dev`; root `npm ci` | Dev server serves on `:5173` with no terminal error |
| ENV-2 | `web/.env` or `web/.env.local` filled from `web/.env.example`; restart the server | `/` renders the landing page, not `NotConfigured` |
| ENV-3 | Accounts below exist in Auth + `users/{uid}`; admin claims published (`npm run set:claims -- --uid <uid>`, key outside the repo) | Admin reaches `/admin/dashboard`; donor reaches `/donor/profile` |
| ENV-4 | Java 21 installed (Temurin); `npm run test:rules` at the root | Suite exits 0 with every assert passing |
| ENV-5 | Theme toggle visible on every public screen and the admin sidebar | No screen is unreadable in either theme |

**Fixture accounts.** Real accounts only — there is no demo mode.

| Fixture | Auth state | `users/{uid}` | Used for |
| --- | --- | --- | --- |
| `donor` | verified | `role: donor`, `status: Active`, name/phone/city filled | donor screens, sign-in |
| `donor-new` | verified | same, mostly empty | empty states |
| `donor-unverified` | not verified | `role: donor` | verification gate |
| `admin` | verified, claim `role=admin` | `role: admin`, `status: Active` | admin area |
| `hospital` | verified, claim `role=staff` | `role: hospital`, `hospitalId` | `/welcome`, role gate |
| `donor-suspended` | verified | `status: Suspended` | blocked screen |

## 1. Public screens

| ID | Screen | Steps | Passes when |
| --- | --- | --- | --- |
| PUB-1 | Landing `/` | Open signed out | Hero, stats, partner band and footer render; no console error; at 360 px no horizontal scroll |
| PUB-2 | Landing CTAs | Click "Sign in", "Become a donor", "Request blood", "Become a partner", footer "Admin Login" | Sign-in/Admin Login → `/login`; donor/request → `/register`; partner → `/partner` |
| PUB-3 | Landing theme | Toggle twice, reload | Body only (no AppShell); choice survives reload |
| PUB-4 | Login `/login` | Submit empty; then bad email; then wrong password | Field-level messages; wrong password and unknown account are different; no page reload |
| PUB-5 | Login reveal | Click the eye | Password shows/hides; `aria-pressed` flips |
| PUB-6 | Login success | Sign in as `donor`, then `admin` | Donor → `/donor/profile`; admin → `/admin/dashboard` |
| PUB-7 | Login return path | Signed out, open `/admin/profile` directly, sign in as admin | Arrives on `/admin/profile`, not the default landing |
| PUB-8 | Login Google | Click "Continue with Google", cancel | Popup closes, form still usable, no stuck spinner |
| PUB-9 | Login already-in | Signed in, open `/login` | Redirects to the account's home; unverified → `/verify-email` |
| PUB-10 | Register `/register` | Empty, then bad password, then duplicate email, then valid | Inline errors per field; password rule text matches the message; valid → `/verify-email` |
| PUB-11 | Register as Google | Use Google on `/register` | Verified Google account → `/donor/profile` (no verify screen) |
| PUB-12 | Register scope | Look for a role picker | None — donor only; partner link points at `/partner` (D20) |
| PUB-13 | Partner `/partner` | Empty, then valid submit | Inline errors; success panel with the 2–3 day reply and mailbox fallback |
| PUB-14 | Partner failure | Block the Formspree request (DevTools offline) and submit | Error shown, every value still filled, retry works |
| PUB-15 | Partner unset | Remove `VITE_FORMSPREE_ENDPOINT`, restart, submit | Names the fallback email instead of posting |
| PUB-16 | Forgot `/forgot-password` | Empty, unknown email, real email, signed-in visit | Inline error; generic confirmation either way (no account enumeration); signed-in → `/welcome` |
| PUB-17 | Verify `/verify-email` | Unverified account: "I've verified" before clicking the link, then resend, then click the link and retry | Still-not-verified message; resend confirmation; after confirming → donor profile or admin dashboard |
| PUB-18 | Verify redirects | Verified account opens `/verify-email`; signed-out opens it | Verified → home for its role; signed out → `/login` |
| PUB-19 | 404 | Open `/nope` | 404 with Home / Admin Dashboard / Gallery links that work |
| PUB-20 | NotConfigured | Remove `web/.env` and `web/.env.local`, restart, open `/`, `/login`, `/admin/dashboard`, `/privacy` | All routes render the same notice naming the missing `VITE_FIREBASE_*` keys; no route works |

## 2. Gates

| ID | Gate | Steps | Passes when |
| --- | --- | --- | --- |
| GATE-1 | Signed out | Open `/donor/profile`, `/admin/dashboard` | Both → `/login`; after signing in you return to the attempted URL |
| GATE-2 | Unverified | Sign in as `donor-unverified` | Held on `/verify-email`; direct URLs bounce back there |
| GATE-3 | Wrong role | Donor opens `/admin/*`; admin opens `/donor/profile` | Each gets the "not your account type" refusal, not a blank page or a loop |
| GATE-4 | Missing profile | With a throwaway account, delete `users/{uid}`, reload | Auto-provisioned as donor (D20); no loop; a failed write reports itself |
| GATE-5 | Suspended | Suspend a donor and an admin in the console; reload each | Both land on the blocked screen; every guarded URL shows it; sign out works |
| GATE-6 | Reactivate | Set `status: Active`; reload | Normal access returns without re-registration; blocked screen redirects away |
| GATE-7 | Removed | Set `status: Removed`; reload | Blocked screen says the account was closed; no data loads |

## 3. Donor

| ID | Screen | Steps | Passes when |
| --- | --- | --- | --- |
| DON-1 | Profile load | `/donor/profile` as `donor` | Saved name, blood type, birth date, phone and city appear; eligibility line derives from them |
| DON-2 | Profile save | Change name/phone/city → Save → reload | Saved values return; Firestore shows the same; the save survives a second reload |
| DON-3 | Eligibility | Set a birth date under 18, then a recent `lastDonationAt` | Ineligible with a reason; clearing the donation date restores eligibility |
| DON-4 | Location | Set a city; grant, then deny the browser prompt | City-only profile is valid; a granted location stores lat/lng/geohash; denying leaves city intact |
| DON-5 | Empty account | `donor-new` | Empty inputs, no error banner, save works with the required fields |
| DON-6 | Discard + errors | Edit, discard; enter an invalid date | Fields revert; invalid input is refused with a message |

## 4. Admin

| ID | Screen | Steps | Passes when |
| --- | --- | --- | --- |
| ADM-1 | Shell | `/admin/dashboard` and `/admin/blood-requests` | Sidebar + header render; active item matches the URL; body is empty by design; no console error |
| ADM-2 | Sidebar | Count the items; click each | 12 items (Dashboard … Profile, including Accounts, Data Requests and Settings); stubs open; the blood-request badge reads 3; facility pill and sign-out present |
| ADM-3 | Mobile | 820 px and 360 px | Sidebar collapses to the mobile bar; every item reachable; no clipped text |
| ADM-4 | Stub | Open `/admin/inventory` | "Screen not built yet", correct mockup filename, light and dark links open |
| ADM-5 | Admin gate | Suspended admin reload | Blocked screen, not the shell |

Profile and the suspension flow are tested requirement-first in §7.1, because
they are this feature's screen rather than generic shell chrome.

## 5. Cross-cutting

| ID | Case | Passes when |
| --- | --- | --- |
| XC-1 | Theme | Every screen is legible in both themes; the choice survives reload |
| XC-2 | Widths | 360 / 768 / 1280 px: no horizontal scroll, no overlap, forms usable |
| XC-3 | Keyboard | Tab reaches every control in reading order; visible focus; Enter submits; Escape closes modal/drawer |
| XC-4 | Console | No uncaught error, warning, or failed request during the happy path |
| XC-5 | Gallery `/gallery` | Every component renders in both themes; overlay cases open/close |
| XC-6 | Error boundary | Force a render failure (temporary `throw` in a page, reverted after) | Fallback screen appears; a document lands in `errorLogs`; reload recovers |
| XC-7 | Slow network | DevTools "Slow 3G" | Loading states appear; no double submit; buttons disable while busy |

## 6. Security boundary (emulator)

| ID | Run | Passes when |
| --- | --- | --- |
| RUL-1 | `npm run test:rules` | Every assert passes on the current `firestore.rules` |
| RUL-2 | Read the coverage in `firestore.rules.test.mjs` | It covers: suspended and removed accounts reading only their own profile (reference data, hospitals, own writes and requests denied); reactivation restores; a donor cannot list `users`; the admin `users` update shape; `systemConfig` bounds/self-attribution; `dataSubjectRequests` create/process enums, frozen subject/type/createdAt, and `resolvedAt` on close |
| RUL-3 | CI | The `rules` job is green on the PR (D19) — this is the run of record when the local machine has no Java |

## 7. Feature coverage — what can be smoked today

| Feature | Screen(s) today | Smoke now |
| --- | --- | --- |
| F1 accounts/profile/sign-in | `/login`, `/register`, `/donor/profile` | §1, §3 |
| F2 verification, error logging | `/verify-email` (now behind `RequireAuth`), error boundary | PUB-17/18, GATE-2, XC-6 |
| F3–F8 | none — routes are stubs or absent | not smokeable |
| F9 admin accounts/data requests | `/admin/profile`, `/admin/accounts`, `/admin/settings`, `/admin/data-requests`, `/donor/privacy`, `/privacy` | **§7.1** |
| F10–F12 | none | not smokeable |

A stub screen is not a feature test: ADM-4 verifies the stub seam only. When a
feature ships, its cases move here and its row in `docs/REQUIREMENTS.md` moves
with them.

### 7.1 F9 cases — account management, data requests, settings, privacy

F9 adds cases to §4 (admin chrome) and has its own screens. Run them on a
**staging project** with `web/.env.local` filled and the admin claim published;
several of them close an account.

| ID | Screen | Steps | Passes when |
| --- | --- | --- | --- |
| F9-1 | Accounts list | `/admin/accounts` as an admin | Every donor and hospital account lists with role and status; the active/suspended/removed counts match the rows |
| F9-2 | Accounts search | Filter by role, by status, and type a name, an email, and a uid | Each filter narrows the table; no result shows the empty message rather than a blank table |
| F9-3 | Account details | Open View on a donor | Account id, role, status, email, phone, city, blood type, hospital and last-updated render; an empty field shows `—`, not `undefined` |
| F9-4 | Suspend | Suspend a donor with a reason | Confirmation names the account; a blank reason is refused; after confirming, the row reads Suspended and `status`/`statusReason`/`statusUpdatedAt` are in Firestore |
| F9-5 | Suspension is real | Sign in as the suspended donor, then call Firestore directly from the console | The app lands on the blocked screen; the same read via the SDK is `permission-denied`, so the block is not UI-only |
| F9-6 | Restore | Restore the suspended donor | The reason is cleared, the row reads Active, and the account loads normally on reload |
| F9-7 | Remove | Remove a donor with a reason | Confirmation warns it cannot be undone; after confirming, the row reads Removed and the account is blocked exactly like a suspended one |
| F9-8 | Create hospital | New hospital account → fill every required field → Create, once with the function deployed and once without | Deployed: the account appears as a hospital with a facility record and the `staff` claim. Undeployed: the screen says the service is not deployed, names `npm run create:hospital` as the fallback, shows no raw SDK code (`internal [0]`), and nothing is written |
| F9-9 | Create validation | Submit empty, a bad email, a short password, and one coordinate only | Each field reports its own message; nothing is sent |
| F9-10 | Delete sign-in | Open a Removed account → Delete sign-in record | With the function deployed the Auth user is gone and the profile stays; with it undeployed the error names the missing deployment |
| F9-11 | Settings load | `/admin/settings` | The stored retry limit, interval and tiers appear; an unwritten document shows the D18 defaults with "never saved" |
| F9-12 | Settings save | Raise the retry limit, add a tier, save, reload | Values persist; last-saved names the signed-in admin; the matcher reads the same document |
| F9-13 | Settings invalid | Enter 0 tiers, 9 tiers, a shrinking radius, a radius of 0, and a blank interval | Each is refused with a message and the Save button never writes |
| F9-14 | Settings gate | Signed in as a donor, write `systemConfig/global` from the console | `permission-denied`; the screen is unreachable at `/admin/settings` |
| F9-15 | Privacy submit | `/donor/privacy` → choose each type → submit | The request appears in "Your requests" as Pending with the detail; a blank detail is refused |
| F9-16 | Request isolation | As a second donor, read the first donor's request by id from the console | `permission-denied`; the list shows only the signed-in donor's requests |
| F9-17 | Access/export | Admin opens an Access or Export request → Download data copy | A JSON file downloads holding that account's profile, matches, donations, rewards, consents, requests and posted blood requests, and no other account's records |
| F9-18 | Correction | Admin opens a Correction request, edits the name/phone/city, applies | The profile shows the corrected values; the request records `resolutionAction: Correction` |
| F9-19 | Erasure | Admin opens an Erasure request, types a reason, erases | Identifying fields are blanked, the account is closed, donations/audit rows remain, and `resolutionAction: Deletion`; the sign-in record is then deleted from Accounts (F9-10) so the stored email goes too |
| F9-20 | Queue transitions | Start → Complete and Start → Reject | `processedBy` is the admin, `resolvedAt` is a server time, the note is stored, and the donor sees the status and note |
| F9-21 | Admin profile | `/admin/profile` → change name and phone → save → reload | Values persist, role is unchanged and not editable, and a refresh shows the same data |
| F9-22 | Privacy notice | `/privacy`, and the consent line on `/register` | The notice renders, links work, and the claims in it match the rules (`docs/PRIVACY_AND_CONSENT.md`) |

**Status of this list: written, not run.** The checkout is configured against the
`dugo-plus` project through the gitignored `web/.env`, but no test-account
credentials or published admin claim are available here, and Java is missing for
the emulator. Only the public surfaces were rendered in a browser and inspected:
`/privacy` in both themes (tokens flip, no horizontal overflow, contrast
measured on the body text), the consent link on `/register` resolving to
`/privacy`, `/login` with no console errors, `/nope` returning 404, and
`/donor/privacy` redirecting to `/login` when signed out. The signed-in cases
F9-1 to F9-22 and RUL-1/RUL-2 remain pending. Do not mark an
FR-039/FR-040/FR-041 row done on the strength of this list.

## 8. Recording the run

- Put the result in the PR description: date, commit, project used, and any
  case that failed with its ID.
- A failing case is a blocker, not a note. Fix it or take the row back to
  `partial` before merging.
- A passing run is evidence for the rows it covers: update their **Notes** and
  **Where/evidence** in the same commit. `node tools/check-docs.mjs` must pass.
- With no Firebase config (`web/.env` or `web/.env.local`), only the build and
  the emulator suite can run — say so rather than marking a row done.
