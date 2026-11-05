/**
 * The weekly newsletter: the videos published since the last one, to the list.
 *
 *   npm run newsletter                                # what cron runs
 *   npm run newsletter -- --preview you@example.com   # look at the mail first
 *   docker compose run --rm -T bakmark \
 *     node --experimental-strip-types scripts/newsletter.mjs
 *
 * A container's crontab dies with the container, so this is a command, not a
 * daemon: the host's cron calls it (deploy.sh installs that entry on production
 * only). `--hour 19` makes it a no-op unless it is 19:00 in Europe/Amsterdam,
 * which is how one entry per side of daylight saving can be safe.
 *
 * Nothing new means nothing sent: a newsletter that says "no news this week"
 * trains the list to ignore the next one, and every unnecessary mail is a
 * chance to be marked as spam.
 *
 * `--preview <address>` mails every recipe that has a video, concepts included,
 * to that one address, and leaves the snapshot alone, so a test cannot tell the
 * next weekly run that this week's work was already sent.
 *
 * One line comes out, always, so a cron log answers "did it run and what did it
 * find" without a second command.
 */
import { dirname, join } from "node:path";
import { confirmedSubscribers } from "../src/lib/list.ts";
import { sendWeekly } from "../src/lib/newsletter.ts";
import { newSince, readState, snapshotOf, videosIn, writeState } from "../src/lib/videos.ts";

const TIME_ZONE = "Europe/Amsterdam";

const argument = (name) => {
	const index = process.argv.indexOf(`--${name}`);
	return index === -1 ? undefined : process.argv[index + 1];
};

const hourIn = (timeZone, now = new Date()) =>
	Number(
		new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hour12: false }).format(now),
	);

/** A preview goes to one address; the real newsletter goes to the list. */
const previewTo = argument("preview");
const preview = previewTo !== undefined;

const hour = argument("hour");
if (hour !== undefined) {
	// Two cron entries (17:00 and 18:00 UTC) cover the two sides of daylight
	// saving; only one of them is 19:00 in the Netherlands, and the other says
	// so in the log instead of mailing a week early.
	const now = hourIn(TIME_ZONE);
	if (String(now) !== hour) {
		console.log(`[newsletter] ${now}:00 in ${TIME_ZONE}, waiting for ${hour}:00; nothing done`);
		process.exit(0);
	}
}

const siteUrl = (process.env.SITE_URL?.trim() || "http://localhost:4321").replace(/\/+$/, "");
// The snapshot lives next to the subscriber list: outside the checkout, so a
// deploy, a rollback or `git reset --hard` cannot make last week's videos new.
const stateFile =
	process.env.NEWSLETTER_STATE?.trim() ||
	join(
		dirname(process.env.SUBSCRIBERS_DB ?? join(process.cwd(), "data", "subscribers.sqlite")),
		"videos-mailed.json",
	);

const videos = videosIn(join(process.cwd(), "recipes"), { includeUnpublished: preview });
const state = readState(stateFile);

if (preview) {
	if (!previewTo) {
		console.error("[newsletter] --preview needs an address: --preview you@example.com");
		process.exit(1);
	}
	const result = await sendWeekly({
		videos,
		siteUrl,
		// A preview uses a throwaway row: no token, so no unsubscribe link, and
		// the mail says it is a test.
		recipients: [{ email: previewTo, lang: "nl", unsubscribeToken: "" }],
		preview: true,
	});
	console.log(
		`[newsletter] preview with ${videos.length} recipe(s) to ${previewTo}; ` +
			`snapshot untouched, sent ${result.sent}`,
	);
	process.exit(result.sent === 1 ? 0 : 1);
}

const fresh = newSince(videos, state);
if (fresh.length === 0) {
	console.log(`[newsletter] ${videos.length} published video(s), 0 new; nothing sent`);
	process.exit(0);
}

const recipients = confirmedSubscribers();
if (recipients.length === 0) {
	// No snapshot either: when the first subscriber arrives they get what is
	// live then, instead of an invisible back catalogue.
	console.log(`[newsletter] ${fresh.length} new video(s), but the list is empty; nothing sent`);
	process.exit(0);
}

const result = await sendWeekly({ videos: fresh, siteUrl, recipients });

if (result.sent === 0) {
	// Every send failed: writing the snapshot now would silently drop these
	// videos from every future newsletter. Fail loudly instead.
	console.error(
		`[newsletter] nothing of ${fresh.length} video(s) reached the ${recipients.length} subscriber(s); snapshot kept`,
	);
	process.exit(1);
}

writeState(stateFile, { ...snapshotOf(videos, state), reported_at: new Date().toISOString() });

console.log(
	`[newsletter] ${fresh.length} new video(s) to ${result.sent}/${recipients.length} subscriber(s): ` +
		fresh.map((video) => video.slug).join(", ") +
		(result.failed.length ? ` (failed: ${result.failed.join(", ")})` : ""),
);

if (result.failed.length) process.exit(1);
