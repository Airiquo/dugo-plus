#!/usr/bin/env bash
#
# Build the app and deploy it to Firebase Hosting.
#
# `firebase deploy` uploads `web/dist` exactly as it finds it and does not
# build, so a deploy without a build would ship whatever was there last. This
# runs the build first and stops if it fails.
#
# Hosting only: `firestore.rules` is deployed deliberately and separately with
# `firebase deploy --only firestore:rules`, because a rules change is a
# different kind of change from shipping the frontend.
#
# The app is built from the branch that is checked out, so the branch is
# printed before the build to make that visible.

set -euo pipefail

cd "$(dirname "$0")/.."

echo "Branch: $(git rev-parse --abbrev-ref HEAD)"

( cd web && npm run build )

firebase deploy --only hosting
