#!/bin/sh
# Deploy Bakmark.
#
#   ./deploy.sh                          # staging, from your machine
#   BAKMARK_ENV=production ./deploy.sh   # production, from your machine
#   ./deploy.sh --local                  # ON the server, deploy this checkout
#
# GitHub Actions runs the same script with --local after checking out trunk, so
# there is one deploy path and not two that can drift. If Actions is down, the
# first form still works: identical code, run from your laptop.
#
# What it does, in order:
#   1. refuse to deploy a dirty tree
#   2. update the server checkout, build the image there (no registry)
#   3. swap the container, keeping the old one until the new one is healthy
#   4. roll back if the health check fails
#
# The subscriber list is a host directory, so a bad deploy cannot lose it.
set -eu

# ---------------------------------------------------------------------------
# Settings. Two environments, one code path: BAKMARK_ENV picks the target and
# everything else follows. The only real differences are the paths, the port
# and whether signups are restricted.
# ---------------------------------------------------------------------------
TARGET="${BAKMARK_ENV:-staging}"

case "$TARGET" in
	production)
		APP_DIR="${BAKMARK_APP_DIR:-/srv/bakmark-production}"
		DATA_DIR="${BAKMARK_DATA_DIR:-/var/lib/bakmark}"
		PORT="${BAKMARK_PORT:-8085}"
		SITE_URL="${SITE_URL:-https://bakmark.nl}"
		SIGNUP_ALLOWED_DOMAINS="${SIGNUP_ALLOWED_DOMAINS:-}"
		;;
	staging)
		APP_DIR="${BAKMARK_APP_DIR:-/srv/bakmark-staging}"
		DATA_DIR="${BAKMARK_DATA_DIR:-/var/lib/bakmark-staging}"
		PORT="${BAKMARK_PORT:-8090}"
		SITE_URL="${SITE_URL:-https://staging.bakmark.nl}"
		SIGNUP_ALLOWED_DOMAINS="${SIGNUP_ALLOWED_DOMAINS:-markmeijerman.eu,mail-tester.com}"
		;;
	*)
		echo "error: unknown BAKMARK_ENV=$TARGET (staging, production)" >&2
		exit 1
		;;
esac

# Both environments send real mail through the host's Postfix. Staging is kept
# safe by the domain allowlist, not by a catcher: mail that never arrives cannot
# tell you whether DMARC, SPF or the content work.
# The container reaches the host's Postfix through host.docker.internal, added
# to compose.yaml as a host-gateway alias. 127.0.0.1 here would be the container
# itself: the connection is refused and every signup 500s.
SMTP_URL="${SMTP_URL:-smtp://host.docker.internal:25}"
HEALTH_URL="${BAKMARK_HEALTH_URL:-http://127.0.0.1:$PORT/}"
HEALTH_TRIES="${BAKMARK_HEALTH_TRIES:-30}"
BRANCH="${BAKMARK_BRANCH:-trunk}"

# ---------------------------------------------------------------------------
# Remote mode: re-run this script on the server, over ssh.
# ---------------------------------------------------------------------------
if [ "${1:-}" != "--local" ]; then
	HOST="${BAKMARK_HOST:-vps1.markmeijerman.nl}"
	USER_="${BAKMARK_USER:-deploy}"

	echo "==> deploying $TARGET to $USER_@$HOST:$APP_DIR"

	git fetch --quiet origin "$BRANCH"
	if [ -n "$(git status --porcelain)" ]; then
		echo "error: the working tree has uncommitted changes." >&2
		echo "       Deploy what is committed; stash or commit first." >&2
		exit 1
	fi

	# The server pulls nothing from GitHub: it is reset to the commit that
	# already exists there, and this script is what the checkout runs.
	ssh "$USER_@$HOST" \
		"BAKMARK_ENV='$TARGET' APP_DIR='$APP_DIR' DATA_DIR='$DATA_DIR' \
		PORT='$PORT' SITE_URL='$SITE_URL' \
		SIGNUP_ALLOWED_DOMAINS='$SIGNUP_ALLOWED_DOMAINS' \
		SMTP_URL='$SMTP_URL' HEALTH_URL='$HEALTH_URL' BRANCH='$BRANCH' \
		'$APP_DIR/deploy.sh' --local"

	echo "==> $TARGET is live: $SITE_URL"
	exit 0
fi

# ---------------------------------------------------------------------------
# Local mode: this runs on the server.
# ---------------------------------------------------------------------------
cd "$APP_DIR"

if [ -n "$(git status --porcelain 2>/dev/null || true)" ]; then
	echo "warning: $APP_DIR has local changes; they will be overwritten" >&2
fi

echo "==> updating $APP_DIR to origin/$BRANCH"
git fetch --quiet origin "$BRANCH"
git reset --hard "origin/$BRANCH"

# The list lives outside the checkout on purpose: the reset above and any
# container rebuild must not be able to touch it.
if [ ! -d "$DATA_DIR" ]; then
	echo "error: data directory $DATA_DIR does not exist." >&2
	echo "       Provisioning creates it (vps1-provisioning, role install_docker)." >&2
	echo "       Run 'make provision-prod' there rather than mkdir: the owner matters." >&2
	exit 1
fi

# Written on every deploy so the container needs no other configuration and
# nothing sensitive has to live in the repository.
CONFIG_FILE=".env"
{
	echo "BAKMARK_ENV=$TARGET"
	echo "COMPOSE_PROJECT_NAME=bakmark-$TARGET"
	echo "BAKMARK_DATA_DIR=$DATA_DIR"
	echo "BAKMARK_PORT=$PORT"
	echo "SITE_URL=$SITE_URL"
	echo "SIGNUP_ALLOWED_DOMAINS=$SIGNUP_ALLOWED_DOMAINS"
	echo "SMTP_URL=$SMTP_URL"
} > "$CONFIG_FILE"
chmod 600 "$CONFIG_FILE"

echo "==> building"
docker compose build

PREVIOUS="$(docker compose ps -q bakmark 2>/dev/null || true)"
PREVIOUS_IMAGE=""
if [ -n "$PREVIOUS" ]; then
	PREVIOUS_IMAGE="bakmark:$TARGET-previous"
	docker tag "$(docker inspect --format '{{.Image}}' "$PREVIOUS")" "$PREVIOUS_IMAGE" 2>/dev/null || true
fi

echo "==> starting"
docker compose up -d --remove-orphans

healthy=""
for _ in $(seq 1 "$HEALTH_TRIES"); do
	if curl -fsS -o /dev/null --max-time 3 "$HEALTH_URL"; then
		healthy=1
		break
	fi
	sleep 2
done

if [ -z "$healthy" ]; then
	echo "error: the new container never answered on $HEALTH_URL" >&2
	docker compose logs --tail 40 bakmark >&2 || true

	if [ -n "$PREVIOUS_IMAGE" ]; then
		echo "==> rolling back" >&2
		docker tag "$PREVIOUS_IMAGE" "bakmark:$TARGET"
		docker compose up -d --no-build bakmark
	fi
	exit 1
fi

echo "==> healthy: $SITE_URL"

# ---------------------------------------------------------------------------
# Smoke test: a healthy container is not a working site.
#
# The health check only proves the process answers. It passed a deploy where
# every signup returned 500 because the container could not reach Postfix, and
# the container was perfectly healthy the whole time.
#
# This runs the two things a visitor does, plus one controlled signup, and then
# removes what it created so the list is exactly as it was found.
# ---------------------------------------------------------------------------
SMOKE_EMAIL="${BAKMARK_SMOKE_EMAIL:-test@markmeijerman.eu}"

echo "==> smoke test"

# curl prints 000 itself when it cannot connect; appending another one made the
# failure unreadable. One helper, one answer.
http_code() {
	curl -sS -o /dev/null -w '%{http_code}' "$@" 2>/dev/null || true
}

home_code="$(http_code --max-time 15 "$SITE_URL/")"
if [ "$home_code" != "200" ]; then
	echo "error: $SITE_URL/ returned $home_code" >&2
	exit 1
fi
echo "    home page: 200"

# A refused address must be refused: this is the check that the allowlist is
# actually wired up, and it must not depend on the mail path working.
refused_code="$(http_code --max-time 15 \
	-X POST "$SITE_URL/api/subscribe" \
	-H 'content-type: application/json' \
	-H "origin: $SITE_URL" \
	--data '{"email":"someone@gmail.com","lang":"nl","elapsed":5000}')"
if [ "$refused_code" != "400" ]; then
	echo "error: a gmail address was not refused (got $refused_code)" >&2
	exit 1
fi
echo "    refused domain: 400"

# The real signup: stores the address and sends the confirmation through the
# host's Postfix. A 500 here is the failure this test exists for.
signup_code="$(http_code --max-time 20 \
	-X POST "$SITE_URL/api/subscribe" \
	-H 'content-type: application/json' \
	-H "origin: $SITE_URL" \
	--data "{\"email\":\"$SMOKE_EMAIL\",\"lang\":\"nl\",\"elapsed\":5000}")"
if [ "$signup_code" != "201" ]; then
	echo "error: signing up $SMOKE_EMAIL returned $signup_code" >&2
	echo "       a 500 usually means the container cannot reach SMTP; check SMTP_URL" >&2
	exit 1
fi
echo "    signup $SMOKE_EMAIL: 201"

# 201 means the app handed the message to Postfix. Confirm none of it is stuck
# in the queue, which is what a wrong host or a refused relay looks like.
if command -v ssh >/dev/null 2>&1 && [ -n "${BAKMARK_TARGET_HOST:-}" ]; then
	queued="$(ssh "$BAKMARK_TARGET_HOST" "sudo -n mailq 2>/dev/null | tail -1" 2>/dev/null || echo unknown)"
	case "$queued" in
		*"empty"*) echo "    mail queue: empty" ;;
		unknown) : ;;
		*) echo "warning: mail queue not empty: $queued" >&2 ;;
	esac
fi

# Remove what the test created. The list belongs to the deployment, and a smoke
# test that leaves addresses behind turns a staging list into noise.
echo "    clearing the test row"
docker compose exec -T bakmark node --input-type=module -e "
import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync(process.env.SUBSCRIBERS_DB ?? '/data/subscribers.sqlite');
db.prepare('DELETE FROM subscribers WHERE email = ?').run('$SMOKE_EMAIL');
db.close();
" || { echo "error: could not clear the smoke-test row" >&2; exit 1; }

echo "==> smoke test passed"
