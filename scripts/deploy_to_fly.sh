#!/usr/bin/env bash
set -euo pipefail

# deploy_to_fly.sh
# Usage: ./scripts/deploy_to_fly.sh [app-name] [region] [volume-size-gb]
# Example: ./scripts/deploy_to_fly.sh hireconnect-api iad 1

APP_NAME=${1:-hireconnect-api}
REGION=${2:-iad}
VOLUME_NAME=${APP_NAME}-data
VOLUME_SIZE=${3:-1}

echo "Checking flyctl..."
if ! command -v fly >/dev/null 2>&1; then
  echo "flyctl not found. Install from https://fly.io/docs/hands-on/install-flyctl/ and run 'fly auth login' before using this script."
  exit 1
fi

set -x

# Create the app (no-op if it already exists)
fly apps create "$APP_NAME" --region "$REGION" || true

# Create a persistent volume for SQLite if not present
fly volumes create "$VOLUME_NAME" --size "$VOLUME_SIZE" --region "$REGION" || true

# Configure required secrets/env
fly secrets set NODE_ENV=production DB_PATH=/data/hireconnect.db || true

# Deploy using the repo Dockerfile (fly will detect it)
fly deploy --remote-only

cat <<'EOF'

Deployment complete.
To seed the database (one-time):
  fly ssh console -a $APP_NAME -- "node --experimental-strip-types --experimental-sqlite src/seed.ts"

After seeding, open the frontend and set the VITE_API_BASE_URL to your API URL (https://<your-app>.fly.dev) when deploying the frontend.

EOF
