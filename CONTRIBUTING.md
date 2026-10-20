# Contributing

The rules for changing this repository. `AGENTS.md` covers how the code should be
written; `docs/PHASES.md` covers how the work is organised. This file covers the
mechanics of getting a change into `main`.

## Branches

| Branch | Role |
| --- | --- |
| `main` | integration. Everything merges here, and it should always build. |
| `feat/<short-name>` | one feature. Branch off `main`, merge back with a PR. |
| `prod` | release mirror. **Nobody commits to it.** |
| `staging` | one person's scratch branch. Do not build on it unless it is yours. |

Name a feature branch for the feature, not the phase: `feat/hospital-requests`,
not `feat/p2`. Phases are a reporting structure, not a unit of work.

```bash
git checkout main && git pull
git checkout -b feat/hospital-requests
```

Rebase on `main` each morning while the branch is open:

```bash
git pull --rebase origin main
```

## Before opening a PR

- [ ] `cd web && npx vite build` passes.
- [ ] Any requirement row this change affects is updated in
      `docs/REQUIREMENTS.md`, in this same PR.
- [ ] The smoke list in `docs/PHASES.md` has been run if the change touched
      `web/src/services/`, `web/src/lib/`, or `firestore.rules`.
- [ ] The screen has been checked against the verification list in
      `docs/PHASES.md` §7 (hierarchy, spacing, states, both themes).
- [ ] The feature works when used, not only when compiled. A stub is not an
      acceptable end state for anything a user can click.

## Opening the PR

- Target `main`.
- Say which requirement rows the PR moves, and to what status.
- Say what you checked, and what you could not check.

## Reviewing

- Does the diff match the stated requirement rows?
- Does `docs/REQUIREMENTS.md` now describe reality? A row marked `done` that a
  user cannot actually walk through is the thing to catch here.
- For anything touching `web/src/services/`, `web/src/lib/`, or
  `firestore.rules`: is there anything that compiles but changes behaviour for
  existing callers? The build will not catch that.

## Shipping

Manual, and only from `main` once it is known good:

```bash
git checkout main && git pull
git checkout prod && git merge --ff-only main && git push
```

`--ff-only` fails if `prod` has drifted, which is the point: drift should be
loud, not silently merged over.

Then deploy: `./tools/deploy.sh` from `prod`. See `docs/DEPLOY.md`.
