#!/bin/sh
# One command to start Bakmark in Docker.
#
#   ./start.sh                     # local:      ./data          on 8085
#   BAKMARK_ENV=staging ./start.sh  # staging:    ./data-staging  on 8086
#   BAKMARK_ENV=production ./start.sh   # needs BAKMARK_DATA_DIR and BAKMARK_PORT
#
# Every environment is treated the same: BAKMARK_ENV names it, and the only
# difference is which variables that deployment sets.
#
# The data directory must exist before the container starts: Docker creates a
# missing bind-mount source as root, and the app runs as uid 1000.
set -eu

cd "$(dirname "$0")"

# Each environment keeps its own list. Staging must never open the file that
# holds real subscribers, so the directory and the port both move with it.
BAKMARK_ENV="${BAKMARK_ENV:-local}"

# Every environment reads the same variables. The only per-environment part is
# a default for the two a throwaway local run should not have to set.
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
		# No defaults: this one serves real subscribers, so its paths come from
		# the deployment's own environment, not from this script.
		DEFAULT_DATA_DIR=""
		DEFAULT_PORT=""
		;;
	*)
		echo "error: unknown BAKMARK_ENV=$BAKMARK_ENV (local, staging, production)" >&2
		exit 1
		;;
esac

# One rule for every environment: a value that was set wins, a default applies
# where this environment has one, and otherwise the variable is required.
require() {
	name="$1"
	value="$2"
	fallback="$3"
	if [ -n "$value" ]; then
		printf '%s' "$value"
		return
	fi
	if [ -n "$fallback" ]; then
		printf '%s' "$fallback"
		return
	fi
	echo "error: $BAKMARK_ENV needs $name to be set." >&2
	echo "       Put it in .env (see env.dist) or pass it to this command." >&2
	exit 1
}

DATA_DIR="$(require BAKMARK_DATA_DIR "${BAKMARK_DATA_DIR:-}" "$DEFAULT_DATA_DIR")"
PORT="$(require BAKMARK_PORT "${BAKMARK_PORT:-}" "$DEFAULT_PORT")"

# Two environments must never share one list. Checked by resolved path, so
# ../bakmark/data and /srv/bakmark/data are recognised as the same file. This
# is not about one environment being risky: it is about a collision being
# silent, and a staging signup landing in the list that gets mailed.
resolved="$(cd "$DATA_DIR" 2>/dev/null && pwd -P || printf '%s' "$DATA_DIR")"
stamp="$DATA_DIR/.bakmark-env"
if [ -f "$stamp" ]; then
	owner="$(cat "$stamp")"
	if [ "$owner" != "$BAKMARK_ENV" ]; then
		echo "error: $resolved belongs to the $owner environment, not $BAKMARK_ENV." >&2
		echo "       Give this environment its own BAKMARK_DATA_DIR." >&2
		exit 1
	fi
fi

# Both must be exported: compose.yaml reads them, and a computed-but-unexported
# port silently falls back to 8085, i.e. staging and production on one port.
export BAKMARK_DATA_DIR="$DATA_DIR"
export BAKMARK_PORT="$PORT"
# One compose project per environment. Without this every checkout on this
# machine shares the name "bakmark", so `docker compose down` in a throwaway
# test directory stops the instance someone is actually using.
export COMPOSE_PROJECT_NAME="bakmark-$BAKMARK_ENV"
MAIL_UI="${MAILPIT_UI_PORT:-8025}"

# Links in confirmation mail must point at the URL a visitor uses.
export SITE_URL="${SITE_URL:-http://localhost:$PORT}"
# Staging is allowlisted by default, not only when someone remembers the
# variable. `BAKMARK_ENV=staging` used to start an unrestricted form unless
# SIGNUP_ALLOWED_DOMAINS was set by hand, which is the one mistake this file
# exists to prevent: a real address subscribed, was mailed, and the run said
# nothing about it. Local development stays unrestricted.
if [ "$BAKMARK_ENV" = "staging" ]; then
	: "${SIGNUP_ALLOWED_DOMAINS:=markmeijerman.eu,mail-tester.com}"
else
	: "${SIGNUP_ALLOWED_DOMAINS:=}"
fi
export SIGNUP_ALLOWED_DOMAINS

mkdir -p "$DATA_DIR"
chmod 700 "$DATA_DIR" 2>/dev/null || true

if [ ! -w "$DATA_DIR" ]; then
	echo "error: $DATA_DIR is not writable by $(id -un)." >&2
	echo "       Run: sudo install -d -o 1000 -g 1000 -m 700 $DATA_DIR" >&2
	exit 1
fi

# First use claims the directory for this environment.
if [ ! -f "$stamp" ]; then
	printf '%s\n' "$BAKMARK_ENV" > "$stamp"
fi

# Mailpit is a development tool and sits in the "dev" profile, so a staging or
# production run of this script never starts one: their mail goes through the
# host's Postfix (see deploy.sh).
if [ "$BAKMARK_ENV" = "local" ]; then
	docker compose --profile dev up --build -d
else
	docker compose up --build -d
fi

echo "Bakmark:      http://localhost:$PORT ($BAKMARK_ENV, data in $DATA_DIR)"
if [ -n "$SIGNUP_ALLOWED_DOMAINS" ]; then
	echo "Signups only: @$(echo "$SIGNUP_ALLOWED_DOMAINS" | sed 's/,/ @/g')"
fi
echo "Mail catcher: http://localhost:$MAIL_UI"
