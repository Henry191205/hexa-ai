#!/usr/bin/env bash

set -euo pipefail

PORT="${1:-4173}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR"
echo "Starting Hexa AI local server at http://127.0.0.1:${PORT}/"
python3 -m http.server "${PORT}" --bind 127.0.0.1

