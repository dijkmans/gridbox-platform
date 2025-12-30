#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="/opt/gridbox-agent"

echo "Update agent files in ${TARGET_DIR}"
sudo cp -f "${SRC_DIR}/agent.mjs" "${TARGET_DIR}/agent.mjs"
sudo cp -f "${SRC_DIR}/take-picture.mjs" "${TARGET_DIR}/take-picture.mjs"
sudo cp -f "${SRC_DIR}/CURRENT.txt" "${TARGET_DIR}/CURRENT.txt"

echo "Restart service"
sudo systemctl restart gridbox-agent

echo "Status"
sudo systemctl status gridbox-agent --no-pager
echo "Done."
