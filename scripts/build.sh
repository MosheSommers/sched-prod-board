#!/bin/bash
# Build dist/ from app/: stamp the git sha into the page and write config.js.
# Usage: scripts/build.sh <session-file>   (needs a clean, committed tree)
set -euo pipefail
cd "$(dirname "$0")/.."
SHA=$(git rev-parse HEAD)
rm -rf dist && cp -R app dist
sed -i.bak "s/__BUILD_SHA__/$SHA/g" dist/index.html && rm dist/index.html.bak
cat > dist/config.js <<CFG
export const API = 'https://hq.mega.dev/challenges/show-me-when/api';
export const SESSION = '$(cat "$1")';
CFG
echo "built $SHA"
