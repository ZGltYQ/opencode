#!/bin/bash
# Upload release to GitHub using API
# Usage: ./upload-release.sh <version> <github_token>

VERSION=${1:-"1.0.0"}
GITHUB_TOKEN=${2:-""}
REPO="zgltyq/opencode"
RELEASE_DIR="/home/zgltyq/opencode/packages/opencode/dist/release"

if [ -z "$GITHUB_TOKEN" ]; then
  echo "Error: GitHub token required"
  echo "Usage: $0 <version> <github_token>"
  echo ""
  echo "Create a token at: https://github.com/settings/tokens/new"
  echo "Required scopes: repo"
  exit 1
fi

echo "Creating release v${VERSION}..."

# Create the release
RELEASE_RESPONSE=$(curl -s -X POST \
  -H "Authorization: token ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/${REPO}/releases \
  -d "{\"tag_name\":\"v${VERSION}\",\"name\":\"v${VERSION}\",\"body\":\"Release v${VERSION}\",\"draft\":false,\"prerelease\":false}")

RELEASE_ID=$(echo "$RELEASE_RESPONSE" | grep -o '"id": [0-9]*' | head -1 | grep -o '[0-9]*')

if [ -z "$RELEASE_ID" ]; then
  echo "Error: Failed to create release"
  echo "$RELEASE_RESPONSE"
  exit 1
fi

echo "Release created with ID: $RELEASE_ID"
echo "Uploading assets..."

# Upload each tarball
for file in ${RELEASE_DIR}/*.tar.gz; do
  filename=$(basename "$file")
  echo "Uploading $filename..."

  curl -s -X POST \
    -H "Authorization: token ${GITHUB_TOKEN}" \
    -H "Content-Type: application/gzip" \
    --data-binary @"$file" \
    "https://uploads.github.com/repos/${REPO}/releases/${RELEASE_ID}/assets?name=${filename}" > /dev/null

  echo "✓ $filename uploaded"
done

echo ""
echo "Release v${VERSION} published successfully!"
echo "https://github.com/${REPO}/releases/tag/v${VERSION}"
