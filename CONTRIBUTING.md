# Contributing

The rules for changing this repository. `AGENTS.md` covers how the code should be
written; `docs/PHASES.md` covers how the work is organised. This file covers the
mechanics of getting a change into `main`.

## Branches

| Branch | Role |
| --- | --- |
| `main` | release truth. Only receives `integration`, and it should always build. |
| `integration` | the collect branch. Feature PRs target this, and it is merged into `main` when it is known good. |
| `feat/<short-name>` | one feature. Branch off `integration`, PR back into `integration`. |
| `prod` | release mirror. **Nobody commits to it.** |
| `staging` | the owner's personal experiment branch, unrelated to `main` and never merged. Do not build on it unless it is yours. |

Name a feature branch for the feature, not the phase: `feat/hospital-requests`,
not `feat/p2`. Phases are a reporting structure, not a unit of work.

```bash
git checkout integration && git pull
git checkout -b feat/hospital-requests
```

Rebase on `integration` each morning while the branch is open:

```bash
git pull --rebase origin integration
```

Branch off `integration` rather than `main`, so your work is built on top of
whatever is already collected instead of on top of an older tree.

## Before opening a PR

- [ ] `cd web && npx vite build` passes.
- [ ] `node tools/check-docs.mjs` passes.
- [ ] Any requirement row this change affects is updated in
      `docs/REQUIREMENTS.md` in this same PR: Status, Notes, Where/evidence.
      Notes is required once a row reaches `done` or `partial`.
- [ ] The smoke list in `docs/PHASES.md` has been run if the change touched
      `web/src/services/`, `web/src/lib/`, or `firestore.rules`.
- [ ] The screen has been checked against the verification list in
      `docs/PHASES.md` §8 (hierarchy, spacing, states, both themes).
- [ ] The feature works when used, not only when compiled. A stub is not an
      acceptable end state for anything a user can click.

## Opening the PR

- Target `integration`, unless you are the owner merging `integration` into `main`.
- Say which requirement rows the PR moves, and to what status.
- Say what you checked, and what you could not check.

## Reviewing

- Does the diff match the stated requirement rows?
- Does `docs/REQUIREMENTS.md` now describe reality? A row marked `done` that a
  user cannot actually walk through is the thing to catch here.
- Does a row whose behaviour deviated carry a Notes entry, rather than burying
  the deviation in Where/evidence?
- For anything touching `web/src/services/`, `web/src/lib/`, or
  `firestore.rules`: is there anything that compiles but changes behaviour for
  existing callers? The build will not catch that.

## Shipping

Two steps. First get `integration` onto `main`, once the collected work is known
good and the checks are green:

```bash
git checkout integration && git pull
git checkout main && git pull
git merge --no-ff integration && git push
```

Then `main` to `prod`, which is manual and fast-forward only:

```bash
git checkout main && git pull
git checkout prod && git merge --ff-only main && git push
```

`--ff-only` fails if `prod` has drifted, which is the point: drift should be
loud, not silently merged over.

Then deploy: `./tools/deploy.sh` from `prod`. See `docs/DEPLOY.md`.
