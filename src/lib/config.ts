/**
 * One place for the numbers the newsletter promises to the reader.
 *
 * The mail says "we delete it after X" and the cleanup job that makes that
 * true reads the same constant, so the promise and the behaviour cannot drift.
 */

/** Hours an unconfirmed address is kept after signup, then deleted. */
export const UNCONFIRMED_TTL_HOURS = 24;

/** Used in the mail and in the page copy: "24 uur" must match the job. */
export const UNCONFIRMED_TTL_LABEL = { nl: "24 uur", en: "24 hours" } as const;

/** ISO timestamp before which a still-unconfirmed row is expired. */
export const unconfirmedCutoff = (now = Date.now()): string =>
	new Date(now - UNCONFIRMED_TTL_HOURS * 60 * 60 * 1000).toISOString();
