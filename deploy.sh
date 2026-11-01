#!/usr/bin/env bash
# One-shot deploy to GitHub Pages: creates the repo (first run), pushes, enables Pages, waits for the live URL.
set -euo pipefail
cd "$(dirname "$0")"
REPO="${1:-ciel-edition-01}"
OWNER="$(gh api user -q .login)"

if ! git remote get-url origin >/dev/null 2>&1; then
  gh repo create "$REPO" --public --source=. --remote=origin --push \
    --description "CIEL Édition 01 — immersive jacket product page"
else
  git push -u origin main
fi

# Enable GitHub Pages from main:/ (no-op if already enabled)
gh api -X POST "repos/$OWNER/$REPO/pages" \
  -f build_type=legacy -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1 || true

URL="$(gh api "repos/$OWNER/$REPO/pages" -q .html_url)"
echo "Pages URL: $URL"
echo "Waiting for the first build (usually under a minute)…"
for _ in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$URL" || true)"
  if [ "$code" = "200" ]; then echo "LIVE: $URL"; exit 0; fi
  sleep 10
done
echo "Still building — check later with: gh api repos/$OWNER/$REPO/pages/builds/latest"
