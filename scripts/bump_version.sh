#!/bin/bash
set -e
# Usage: update package.json and pkg/harvester/package.json to desired version
# Example: ./scripts/bump_version.sh v1.8.0-rc3

VERSION="$1"

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 v1.8.0-rc3"
  exit 1
fi

# Strip leading 'v' if present
VERSION="${VERSION#v}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

FILES=(
  "$ROOT_DIR/package.json"
  "$ROOT_DIR/pkg/harvester/package.json"
)

for FILE in "${FILES[@]}"; do
  if [ ! -f "$FILE" ]; then
    echo "File not found: $FILE"
    exit 1
  fi

  # Use node to update version in-place while preserving formatting
  node -e "
    const fs = require('fs');
    const raw = fs.readFileSync('$FILE', 'utf8');
    const updated = raw.replace(/\"version\":\s*\"[^\"]*\"/, '\"version\": \"$VERSION\"');
    fs.writeFileSync('$FILE', updated);
  "

  echo "Updated $FILE -> $VERSION"
done
