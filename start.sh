#!/bin/sh
# One command to start Bakmark in Docker.
#
#   ./start.sh                                     # local: ./data, port 8085
#   BAKMARK_ENV=staging ./start.sh                  # ./data-staging, port 8086
#   BAKMARK_DATA_DIR=/var/lib/bakmark ./start.sh    # production on the VPS
#
# The data directory must exist before the container starts: Docker creates a
# missing bind-mount source as root, and the app runs as uid 1000.
set -eu

cd "$(dirname "$0")"

# Each environment keeps its own list. Staging must never open the file that
# holds real subscribers, so the directory and the port both move with it.
BAKMARK_ENV="${BAKMARK_ENV:-local}"

case "$BAKMARK_ENV" in
	local)
		DEFAULT_DATA_DIR="./data"
		DEFAULT_PORT=8085
		;;
	staging)
		DEFAULT_DATA_DIR="./data-staging"
		DEFAULT_PORT=8086
		;;
	production)
		echo "error: BAKMARK_ENV=production would fall back to ./data." >&2
		echo "       Set BAKMARK_DATA_DIR explicitly, e.g.:" >&2
		echo "       BAKMARK_DATA_DIR=/var/lib/bakmark ./start.sh" >&2
		exit 1
		;;
	*)
		echo "error: unknown BAKMARK_ENV=$BAKMARK_ENV (local, staging)" >&2
		exit 1
		;;
esac

DATA_DIR="${BAKMARK_DATA_DIR:-$DEFAULT_DATA_DIR}"
PORT="${BAKMARK_PORT:-$DEFAULT_PORT}"

# An explicit path can still be the production one. Refuse rather than let a
# staging run write test addresses into the real list.
if [ "$BAKMARK_ENV" = "staging" ]; then
	resolved="$(cd "$DATA_DIR" 2>/dev/null && pwd -P || printf '%s' "$DATA_DIR")"
	case "$resolved" in
		*/data | */data/ | /var/lib/bakmark | /var/lib/bakmark/)
			echo "error: staging points at the production list ($resolved)." >&2
			echo "       Use ./data-staging or /var/lib/bakmark-staging." >&2
			exit 1
			;;
	esac
fi

# Both must be exported: compose.yaml reads them, and a computed-but-unexported
# port silently falls back to 8085, i.e. staging and production on one port.
export BAKMARK_DATA_DIR="$DATA_DIR"
export BAKMARK_PORT="$PORT"
MAIL_UI="${MAILPIT_UI_PORT:-8025}"

# Links in confirmation mail must point at the URL a visitor uses.
export SITE_URL="${SITE_URL:-http://localhost:$PORT}"
# Set on staging only, e.g. markmeijerman.eu,mail-tester.com
: "${SIGNUP_ALLOWED_DOMAINS:=}"
export SIGNUP_ALLOWED_DOMAINS

mkdir -p "$DATA_DIR"
chmod 700 "$DATA_DIR" 2>/dev/null || true

if [ ! -w "$DATA_DIR" ]; then
	echo "error: $DATA_DIR is not writable by $(id -un)." >&2
	echo "       Run: sudo install -d -o 1000 -g 1000 -m 700 $DATA_DIR" >&2
	exit 1
fi

docker compose up --build -d

echo "Bakmark:      http://localhost:$PORT ($BAKMARK_ENV, data in $DATA_DIR)"
if [ -n "$SIGNUP_ALLOWED_DOMAINS" ]; then
	echo "Signups only: @$(echo "$SIGNUP_ALLOWED_DOMAINS" | sed 's/,/ @/g')"
fi
echo "Mail catcher: http://localhost:$MAIL_UI"
