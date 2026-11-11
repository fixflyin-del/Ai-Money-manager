#!/usr/bin/env bash
# Fixfly Innovations - AI Money Manager GitHub Push Helper
# Usage: ./scripts/push-to-github.sh <YOUR_GITHUB_PERSONAL_ACCESS_TOKEN>

set -e

TOKEN="$1"

if [ -z "$TOKEN" ]; then
  echo "Usage: ./scripts/push-to-github.sh <YOUR_GITHUB_PERSONAL_ACCESS_TOKEN>"
  echo ""
  echo "Alternatively, push directly with your authenticated git credentials:"
  echo "  git push origin main --force"
  exit 1
fi

REMOTE_URL="https://${TOKEN}@github.com/getfixfly/AIMONEYMANAGER.git"

echo "🚀 Pushing release v6.1.3 to https://github.com/getfixfly/AIMONEYMANAGER..."
git push "$REMOTE_URL" main:main --force
git push "$REMOTE_URL" --tags --force
echo "✅ Push successful! Vercel will automatically build and deploy production."
