#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  npm run ship -- "Context-rich commit message"
  bash scripts/commit-push-deploy.sh "Context-rich commit message"

Purpose:
  Create a useful development checkpoint for future AI-assisted work.
  The commit message should explain what changed, why it matters, and
  what verification was performed so another AI or developer can safely
  continue from this commit.

Commit message guidance:
  Prefer a concise subject plus bullet body when the change has meaningful
  product, architecture, implementation, or documentation context.

  Example:
    npm run ship -- "Improve English conversion flow

    - Keep the picker focused on selectable segment options for large inputs.
    - Document the behavior and any architecture or QA context that changed.
    - Verification: npm test and npm run build."

Environment:
  RUN_TESTS=0          Skip npm run test.
  DEPLOY_WORKER=0      Skip Cloudflare Worker deploy detection.
  FIREBASE_ONLY=value  Override Firebase deploy target. Defaults to auto.

This command verifies, builds, commits, pushes, and deploys the hosted app.
USAGE
}

commit_message="${*:-}"
if [[ "$commit_message" == "-h" || "$commit_message" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -z "$commit_message" ]]; then
  usage
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "This command must be run from inside the git repository." >&2
  exit 1
fi

branch="$(git branch --show-current)"
if [[ -z "$branch" ]]; then
  echo "Cannot determine the current git branch." >&2
  exit 1
fi
upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"

echo "==> Current branch: $branch"
echo "==> Pending git changes:"
git status --short

if [[ "${RUN_TESTS:-1}" != "0" ]]; then
  echo "==> Running tests"
  npm run test
fi

echo "==> Setting production translation endpoint"
printf '%s\n' 'VITE_TRANSLATION_API_URL=https://free-writing-translation.free-writing-danielsegatto.workers.dev' > .env.production.local

echo "==> Building production app"
npm run build

echo "==> Staging unignored changes"
git add -A

made_commit=0
if git diff --cached --quiet; then
  echo "==> No staged source changes to commit"
else
  echo "==> Creating commit"
  git commit -m "$commit_message"
  made_commit=1
fi

if [[ -n "$upstream" ]]; then
  changed_files="$(git diff --name-only "$upstream"...HEAD)"
elif [[ "$made_commit" == "1" ]]; then
  changed_files="$(git show --name-only --format='' HEAD)"
else
  changed_files=""
fi

echo "==> Pushing $branch"
git push -u origin "$branch"

if [[ "${DEPLOY_WORKER:-auto}" != "0" ]]; then
  if printf '%s\n' "$changed_files" | grep -Eq '^(workers/translation/|wrangler\.jsonc)'; then
    echo "==> Worker files changed; deploying Cloudflare Worker"
    npx wrangler deploy
  else
    echo "==> Worker files unchanged; skipping Cloudflare Worker deploy"
  fi
fi

if [[ -n "${FIREBASE_ONLY:-}" ]]; then
  firebase_target="$FIREBASE_ONLY"
elif printf '%s\n' "$changed_files" | grep -qx 'firebase.rules'; then
  firebase_target="hosting,firestore:rules"
else
  firebase_target="hosting"
fi

echo "==> Deploying Firebase target: $firebase_target"
npx firebase-tools deploy --only "$firebase_target"

echo "==> Done"
echo "Live app: https://free-writing-e29a1.web.app"
