#!/bin/bash
# Publish dist/ to the gh-pages branch. Run scripts/build.sh first.
set -euo pipefail
cd "$(dirname "$0")/.."
SHA=$(git rev-parse HEAD)
T=$(mktemp -d)
cp -R dist/. "$T"/ && touch "$T/.nojekyll"
git -C "$T" init -q -b gh-pages
git -C "$T" add -A
git -C "$T" -c user.name="Moshe Sommers" -c user.email="moshe@cloverleaf.me" commit -qm "Deploy build $SHA"
git -C "$T" push -q -f "$(git remote get-url origin)" gh-pages
rm -rf "$T"
