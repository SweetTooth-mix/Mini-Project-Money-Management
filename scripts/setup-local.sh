#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/init-env.mjs
docker compose up -d --wait db
npm ci --cache /tmp/kira-npm-cache
npm run setup:reports
npm run db:setup
echo 'Local setup complete. Run npm run dev. Re-running setup preserves existing users and records.'
