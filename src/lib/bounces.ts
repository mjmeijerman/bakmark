/**
 * What Postfix says happened to the mail we sent.
 *
 * The newsletter goes out with `bounce@bakmark.nl` as its envelope sender, so a
 * delivery that fails comes back — to a mailbox at Proton, which this code
 * cannot read. What it *can* read is Postfix's own log on the box that did the
 * sending: every failed attempt is one line there, with the address, the
 * enhanced status code and whether Postfix gave up.
 *
 * A hard bounce (5.x.x, status=bounced) is a dead address and is removed. A soft
 * one (4.x.x, deferred, or a queue that expired) is left alone: a full mailbox
 * or a greylisting server is not a reason to unsubscribe somebody.
 */

export interface Bounce {
	email: string;
	/** Enhanced status code, e.g. 5.1.1. */
	dsn: string;
	/** `bounced`, `expired`, `deferred`. */
	status: string;
	/** The diagnostic Postfix printed, shortened; useful in a log line. */
	reason: string;
}

export interface BounceReport {
	/** Addresses to delete: status=bounced with a 5.x.x code. */
	hard: Bounce[];
	/** Everything else worth counting: deferred, expired, bounced with a 4.x.x. */
	soft: Bounce[];
	/** Lines that parsed but said the mail was accepted. */
	delivered: number;
}

/**
 * One line looks like:
 *
 *   ... postfix/smtp[942084]: 98F29493A2: to=<dead@example.nl>,
 *   relay=mx.example.nl[1.2.3.4]:25, delay=2.7, delays=0/0/0.2/2.5,
 *   dsn=5.1.1, status=bounced (host mx.example.nl said: 550 5.1.1 unknown user)
 *
 * Anything else (pickup, cleanup, qmgr, smtpd rejects) has no `to=` with a dsn
 * and is ignored, which is most of the file.
 */
const LINE = /to=<([^>]+)>,[^\n]*?dsn=(\d+\.\d+\.\d+), status=([a-z]+)(?: \(([^)]*)\))?/;

export const parseBounces = (log: string): BounceReport => {
	const hard = new Map<string, Bounce>();
	const soft = new Map<string, Bounce>();
	let delivered = 0;

	for (const line of log.split("\n")) {
		const match = LINE.exec(line);
		if (!match) continue;

		const [, rawEmail, dsn, status, reason = ""] = match;
		const email = rawEmail.trim().toLowerCase();

		// A bounce of a bounce has an empty sender; there is nothing to remove.
		if (!email.includes("@")) continue;

		if (status === "sent") {
			delivered += 1;
			continue;
		}

		const bounce: Bounce = { email, dsn, status, reason: reason.slice(0, 120) };
		if (status === "bounced" && dsn.startsWith("5.")) hard.set(email, bounce);
		else soft.set(email, bounce);
	}

	return { hard: [...hard.values()], soft: [...soft.values()], delivered };
};
