#!/usr/bin/env bash
set -euo pipefail

OUT="/tmp/gridbox-agent-export.txt"
: > "$OUT"

mask() {
  # maskeer pass in json
  sed -E 's/"pass"[[:space:]]*:[[:space:]]*"[^"]*"/"pass": "***"/g'
}

add_file() {
  local f="$1"
  echo "===== FILE: $f =====" >> "$OUT"
  if [ -f "$f" ]; then
    if [[ "$f" == *.json ]]; then
      cat "$f" | mask >> "$OUT"
    else
      cat "$f" >> "$OUT"
    fi
  else
    echo "(bestaat niet)" >> "$OUT"
  fi
  echo "" >> "$OUT"
}

add_file /opt/gridbox-agent/CURRENT.txt
add_file /opt/gridbox-agent/agent.mjs
add_file /opt/gridbox-agent/take-picture.mjs
add_file /opt/gridbox-agent/config.json
add_file /etc/systemd/system/gridbox-agent.service

ls -lh "$OUT"
echo "Klaar: $OUT"
