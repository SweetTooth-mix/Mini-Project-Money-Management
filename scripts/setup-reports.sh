#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -m venv .venv
.venv/bin/python -m pip install --disable-pip-version-check --cache-dir /tmp/kira-pip-cache -r scripts/excel/requirements.txt
if ! command -v soffice >/dev/null; then
  echo 'PDF memerlukan LibreOffice Calc. Pada Debian/Ubuntu: sudo apt-get install libreoffice-calc fonts-liberation' >&2
  exit 1
fi
echo 'Penjana Excel dan PDF tersedia.'
