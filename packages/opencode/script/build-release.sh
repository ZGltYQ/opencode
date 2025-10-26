#!/bin/bash
# Build a release version with a specific version number
# Usage: ./build-release.sh <version>

VERSION=${1:-"1.0.1"}

echo "Building release version: $VERSION"

# Set version override (channel will default to current branch)
export OPENCODE_VERSION=$VERSION

# Build all platforms
cd "$(dirname "$0")/.."
bun run ./script/build.ts

# Package for release (skip build since we just did it)
bun run ./script/prepare-release.ts $VERSION --skip-build

echo ""
echo "✅ Release $VERSION built successfully!"
echo ""
echo "📦 Files are in: $(pwd)/dist/release/"
echo ""
echo "📤 Next step: Upload to GitHub"
echo "   gh release create v${VERSION} dist/release/*.tar.gz --title \"v${VERSION}\" --notes \"Release v${VERSION}\""
echo ""
echo "   Or upload manually at:"
echo "   https://github.com/zgltyq/opencode/releases/new"
