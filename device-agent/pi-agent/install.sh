#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="/opt/gridbox-agent"
SERVICE_PATH="/etc/systemd/system/gridbox-agent.service"

echo "1) Install naar ${TARGET_DIR}"
sudo mkdir -p "${TARGET_DIR}"

sudo cp -f "${SRC_DIR}/agent.mjs" "${TARGET_DIR}/agent.mjs"
sudo cp -f "${SRC_DIR}/take-picture.mjs" "${TARGET_DIR}/take-picture.mjs"
sudo cp -f "${SRC_DIR}/CURRENT.txt" "${TARGET_DIR}/CURRENT.txt"

# service altijd installeren
sudo cp -f "${SRC_DIR}/gridbox-agent.service" "${SERVICE_PATH}"

echo "2) Config"
if [ ! -f "${TARGET_DIR}/config.json" ]; then
  sudo cp -f "${SRC_DIR}/config.example.json" "${TARGET_DIR}/config.json"
  echo "PAS NU ${TARGET_DIR}/config.json AAN (camera pass, boxId, apiBaseUrl)."
fi

echo "3) Systemd herladen + enable + restart"
sudo systemctl daemon-reload
sudo systemctl enable gridbox-agent
sudo systemctl restart gridbox-agent

echo "4) Status"
sudo systemctl status gridbox-agent --no-pager
echo "Klaar."
