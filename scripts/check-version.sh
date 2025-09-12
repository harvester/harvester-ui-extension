#!/bin/bash
TAG_VERSION=$1

if [[ -z "$TAG_VERSION" ]]; then
  echo "No tag version provided"
  exit 1
fi

VERSION=$(jq -r .version package.json)
EXTENSION_VERSION=$(jq -r .version pkg/harvester/package.json)
PKG_VERSION="v${EXTENSION_VERSION}"

if [[ "$VERSION" != "$EXTENSION_VERSION" ]]; then
  echo "Package version mismatch: $VERSION vs $EXTENSION_VERSION"
  exit 1
fi

if [[ "${TAG_VERSION}" != "${PKG_VERSION}"* ]]; then
  echo "Package version $PKG_VERSION in pkg/harvester/package.json does not match tag version ${TAG_VERSION}"
  exit 1
fi

echo "Package version and tag version match: ${TAG_VERSION}"
