/**
 * Delete the addresses Postfix says do not exist.
 *
 *   docker compose run --rm -T bakmark node --experimental-strip-types \
 *     scripts/bounces.mjs < /var/log/mail.log
 *
 * Reads a Postfix log on stdin. deploy.sh installs the daily cron entry, which
 * feeds it /var/log/mail.log on the host — the log the box that sends the
 * newsletter actually writes, not a mailbox we would need credentials for.
 *
 * Only a hard bounce (status=bounced with a 5.x.x code) removes an address. A
 * deferral, a greylisting or an expired queue entry leaves the row alone: those
 * are the receiving side having a bad day, not a dead mailbox.
 *
 * One line comes out, always, so a cron log answers what happened.
 */
import { readFileSync } from "node:fs";
import { parseBounces } from "../src/lib/bounces.ts";
import { deleteByEmail } from "../src/lib/list.ts";

const file = process.argv.slice(2).includes("--file")
	? process.argv[process.argv.indexOf("--file") + 1]
	: null;

const log = file ? readFileSync(file, "utf8") : readFileSync(0, "utf8");
const { hard, soft, delivered } = parseBounces(log);

let removed = 0;
for (const bounce of hard) {
	if (deleteByEmail(bounce.email)) {
		removed += 1;
		console.log(`[bounces] removed ${bounce.email} (${bounce.dsn}) — ${bounce.reason || "no reason given"}`);
	} else {
		// Not on the list (any more): a bounce for an address we already lost.
		console.log(`[bounces] ${bounce.email} bounced (${bounce.dsn}) but is not on the list`);
	}
}

console.log(
	`[bounces] ${hard.length} hard bounce(s), ${removed} removed; ` +
		`${soft.length} soft (kept); ${delivered} delivered`,
);

if (hard.length > 0 && removed === 0) {
	// Every bounce was for an address that is already gone: almost certainly the
	// wrong subscriber database, not a list full of dead mailboxes.
	console.error(`[bounces] none of ${hard.length} bounced address(es) existed in the list; check SUBSCRIBERS_DB`);
	process.exit(1);
}
