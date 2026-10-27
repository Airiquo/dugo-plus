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
| ENV-2 | `web/.env.local` filled from `web/.env.example`; restart the server | `/` renders the landing page, not `NotConfigured` |
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
| PUB-20 | NotConfigured | Rename `web/.env.local`, restart, open `/`, `/login`, `/admin/dashboard` | All routes render the same notice naming the missing `VITE_FIREBASE_*` keys; no route works |

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
| ADM-2 | Sidebar | Count the items; click each | 10 items; stubs open; the blood-request badge reads 3; facility pill and sign-out present |
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
| RUL-2 | Read the suspension section of `firestore.rules.test.mjs` | It covers: suspended read of own profile allowed; reference data, hospitals, own writes and data requests denied; reactivation restores |
| RUL-3 | CI | The `rules` job is green on the PR (D19) — this is the run of record when the local machine has no Java |

## 7. Feature coverage — what can be smoked today

| Feature | Screen(s) today | Smoke now |
| --- | --- | --- |
| F1 accounts/profile/sign-in | `/login`, `/register`, `/donor/profile` | §1, §3 |
| F2 verification, error logging | `/verify-email` (now behind `RequireAuth`), error boundary | PUB-17/18, GATE-2, XC-6 |
| F3–F8 | none — routes are stubs or absent | not smokeable |
| F9 admin accounts/data requests | `/admin/profile` and the suspension gate; rest planned | **§7.1** |
| F10–F12 | none | not smokeable |

A stub screen is not a feature test: ADM-9 verifies the routing seam only. When
a feature ships, its cases move here and its row in `docs/REQUIREMENTS.md`
moves with them.

### Planned F9 cases (add with each increment)

| Increment | Cases |
| --- | --- |
| `/admin/accounts` | list/filter by role and status; suspend requires a reason; the donor is blocked on reload; reactivate restores; `statusReason`/`statusUpdatedAt` land in Firestore; hospital creation script writes Auth + profile + facility + claims |
| `/admin/settings` | read/save `systemConfig/global`; validation; donor cannot write; values persist |
| `/donor/privacy` + `/admin/data-requests` | donor submits; admin moves Pending → InProgress → Completed/Rejected with a note; donor sees only their own; `processedBy`/`resolvedAt` set |

## 8. Recording the run

- Put the result in the PR description: date, commit, project used, and any
  case that failed with its ID.
- A failing case is a blocker, not a note. Fix it or take the row back to
  `partial` before merging.
- A passing run is evidence for the rows it covers: update their **Notes** and
  **Where/evidence** in the same commit. `node tools/check-docs.mjs` must pass.
- With no `web/.env.local`, only the build and the emulator suite can run —
  say so rather than marking a row done.
