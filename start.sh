#!/bin/sh
# One command to start Bakmark in Docker.
#
#   ./start.sh                                     # local, ./data, port 8085
#   BAKMARK_DATA_DIR=/var/lib/bakmark ./start.sh    # on the VPS
#
# The data directory must exist before the container starts: Docker creates a
# missing bind-mount source as root, and the app runs as uid 1000.
set -eu

cd "$(dirname "$0")"

DATA_DIR="${BAKMARK_DATA_DIR:-./data}"
PORT="${BAKMARK_PORT:-8085}"
MAIL_UI="${MAILPIT_UI_PORT:-8025}"

# Links in confirmation mail must point at the URL a visitor uses.
export SITE_URL="${SITE_URL:-http://localhost:$PORT}"

mkdir -p "$DATA_DIR"
chmod 700 "$DATA_DIR" 2>/dev/null || true

if [ ! -w "$DATA_DIR" ]; then
	echo "error: $DATA_DIR is not writable by $(id -un)." >&2
	echo "       Run: sudo install -d -o 1000 -g 1000 -m 700 $DATA_DIR" >&2
	exit 1
fi

docker compose up --build -d

echo "Bakmark:      http://localhost:$PORT"
echo "Mail catcher: http://localhost:$MAIL_UI"
