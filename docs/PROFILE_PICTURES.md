# Optional profile pictures

Owner-requested extension, D39; F1/F9; FR-04, FR-012, FR-047.

## Behavior

- Donor: `/home` (also reachable through `/donor/profile`).
- Admin: `/admin/profile`.
- Hospital staff: `/hospital/profile`, linked in the hospital sidebar.
- Choose a JPG, PNG or WebP up to 5 MB, preview it, then Save photo or Cancel.
  Picture saves are independent of other profile fields and do not reset unsaved details.
- Replace or remove the current picture. Navigation refreshes immediately after
  the profile write succeeds. Missing, cleared and broken images show initials.
- On the donor profile card, the saved picture is the primary identity marker;
  the donor name and blood type appear below it.
- Failed uploads preserve the existing picture. If upload succeeds but the
  profile write fails, retry reuses that upload while the editor remains open.
- Missing Cloudinary configuration disables choosing/uploading, while ordinary
  profile edits and removal of an existing picture still work.

## Configuration

In the deployment environment or gitignored `web/.env.local`:

```dotenv
VITE_CLOUDINARY_CLOUD_NAME=<cloud name>
VITE_CLOUDINARY_UPLOAD_PRESET=<unsigned preset name>
```

Restart Vite after changing these values; production values are baked in at build
time. Both values are public. Do not put a Cloudinary API secret in any `VITE_*`
variable. This feature does not require an API key or a Cloudinary SDK dependency.

In Cloudinary Settings → Upload → Upload presets, configure the named preset:

1. Signing mode **Unsigned**.
2. Allowed formats `jpg,jpeg,png,webp`; restrict uploads to image assets.
3. Set an asset folder for profile pictures, unique generated public IDs, and
   disallow client-specified public IDs. Do not allow overwriting existing assets.
4. Normalize incoming image dimensions (for example, a 512px square crop) and
   strip image metadata. Review account upload quotas and abuse monitoring.

The browser checks 5 MB before uploading. Cloudinary does not offer a per-preset
file-size cap; the public preset can be called outside the app, bypassing client
checks. A Firebase-authenticated signing backend would be needed to restrict
upload authorization server-side. These provider restrictions need console
verification; a successful upload alone does not verify them.

Sources: [Cloudinary upload presets](https://cloudinary.com/documentation/upload_presets),
[client-side uploads](https://cloudinary.com/documentation/client_side_uploading).

## Data and privacy

`users/{uid}.photoURL` is optional, validated as an HTTPS Cloudinary image delivery
URL (maximum 2048 characters); `''` clears it. No collection or index is added.
`saveProfilePhoto()` updates only this field and `updatedAt` on an existing
document. Existing ownership, role and suspension boundaries still apply.

The profile document remains private to its owner/admin. The image itself has a
public Cloudinary delivery URL; the editor and `/privacy` disclose that fact.
The notice version is `2026-11-01`; prior acceptance records are unchanged.

Remove, replace and account anonymisation clear/replace the account's reference,
without deleting the Cloudinary asset. A cancelled/failed save after upload may
also leave an unused asset. Support must delete current/replaced/unused copies
from the Cloudinary Media Library and invalidate cached delivery copies when
processing erasure. No provider deletion secret or signing backend is shipped.

## Verification — 2026-11-01

- `cd web && npx vite build`, `node tools/check-docs.mjs` and
  `git diff --check` pass. The final `dist/` contains the hospital profile route,
  Cloudinary configuration/upload endpoint and the photo/editor CSS. Vite still
  reports the existing large-bundle advisory.
- `npm run test:profile-photos`: 2 tests pass (URL boundary,
  supported formats, empty and oversized files).
- Firestore emulator suite: **183 passed, 0 failed**, using a temporary official
  Temurin Java 21 runtime. Includes own-photo writes for all three roles, removal,
  invalid URL/type/length rejections, cross-account and suspension denials.
- Provider test: the owner supplied cloud `dmecmkdww`, preset
  `dugo-plus-profiles`. The initial request was rejected because the preset was
  signed; after the owner enabled Unsigned, a 366-byte generated icon uploaded
  successfully. Retained QA asset public ID: `ggjnukiixui94dk2m1hp` (no personal data).
- Browser smoke using the actual application, real Auth/Firestore SDKs and
  isolated local emulators: donor sign-in reaches `/home`; saved details load;
  changing city, saving and reloading persists; an unverified account stays at
  `/verify-email`, including a direct attempt at `/hospital/profile`.
- Actual Cloudinary uploads from each role's editor persist to the emulator and
  appear in both the profile and navigation after reload. Donor removal persists
  after reload; a photo save preserves the unsaved city field. These are local
  account checks, not production-account checks.
- Retained generated QA icon assets from those browser uploads:
  `qtagnzu0ccjeutorbz2b`, `mlxwcg80lesvirhlufbj`, `w3mtvsieeplr9uritey0`.
- Isolated fixtures exercise unsupported SVG, >5 MB files, upload failure,
  malformed provider response and profile-write failure. Each shows its explicit
  error; the previous saved picture remains intact. Broken-image fallback is
  visible when the fixture's original nonexistent delivery URL fails.
- All three screens have no horizontal overflow at 360, 768 and 1280px viewport
  settings; donor/hospital light/dark layouts inspected. Mobile staff avatar and
  sign-out remain usable together. Actual Android/iOS hardware is not tested.
- A separate actual-app instance with all Firebase environment values missing
  renders NotConfigured for `/hospital/profile`; there is no bypass.
- Proof image: `/private/tmp/dugo-profile-photo-qa/admin-profile-proof.png`.
- No production accounts, Hosting deployment or Firestore rules deployment are
  included. Local Firebase emulator checks do not certify production credentials,
  custom claims, rules deployment or Cloudinary preset restrictions.
