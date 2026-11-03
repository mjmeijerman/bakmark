/**
 * Delete addresses that were never confirmed.
 *
 *   npm run purge                       # on the host, with the app's env
 *   docker compose run --rm bakmark purge   # inside the container
 *
 * A container's crontab dies with the container, so this is a command, not a
 * daemon: the host's cron calls it. It is also safe to call by hand.
 */
import { UNCONFIRMED_TTL_HOURS, unconfirmedCutoff } from "../src/lib/config.ts";
import { purgeUnconfirmed } from "../src/lib/list.ts";

const cutoff = unconfirmedCutoff();
const removed = purgeUnconfirmed(cutoff);

// One line, always, so a cron log answers "did it run" without a second command.
console.log(
	`[purge] removed ${removed} unconfirmed address${removed === 1 ? "" : "es"} ` +
		`older than ${UNCONFIRMED_TTL_HOURS} hours (created before ${cutoff})`,
);
