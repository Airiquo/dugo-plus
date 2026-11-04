# November 4 workflow release

The owner authorizes merging the four request/donation, privacy-review,
hospital-donor and caret/admin-visibility workstreams into protected integration
and redeploying. This release combines D79–D82; their feature documents retain
behavior, consent, legacy-data and validation details. Older unmerged staged
collection/stocking branches are outside this release and must not replace the
owner's Completed-adds-stock flow.

## Combined verification

- 149 unit regressions, six data-request service/review checks, 258 security-rule
  checks and 45 real emulator transaction/security checks pass. The emulator
  checks comprise 27 completion/response/history, six directory, seven accounts
  and five matching cases, all against demo projects.
- Production Vite build, Worker dry-run bundle, docs validation, whitespace and
  compiled route/action/style checks pass. The existing bundle-size warning
  remains. Shared documentation, CSS and Worker imports retain all four features;
  duplicate hospital/donor index definitions are deduplicated.
- CI additionally exercises directory utilities, completion/history and directory
  isolation. Feature browser coverage remains as recorded in each handoff.
- Live donor/hospital sign-in, save/reload, unverified-account and real-device
  checks are not claimed. This coordinating session has no supplied test-account
  credentials; no operational records are created or changed for release checks.

## Release targets

Runtime Firebase remains dugo-plus-clean. Deploy the three additive donation
indexes and wait until ready, publish the existing dugo-matching Worker without
changing its secrets, deploy the reviewed data-request rules, then build from
clean merged integration and deploy Hosting. Keep both dugo-plus-clean.web.app
and the existing dugo-plus.web.app mirror on identical compiled output, following
the fresh-project setup. Verify both domains' source stamp, HTML/JS hashes and
cache policy with tools/verify-hosting-build.mjs. No main/prod promotion, migration,
stock replay or live-data cleanup is part of this release.
