/**
 * One place for the numbers the newsletter promises to the reader.
 *
 * The mail says "we delete it after X" and the cleanup job that makes that
 * true reads the same constant, so the promise and the behaviour cannot drift.
 */

/** Days an unconfirmed address is kept after signup, then deleted. */
export const UNCONFIRMED_TTL_DAYS = 7;

/** Used in the mail and in the page copy: "7 days" must match the job. */
export const UNCONFIRMED_TTL_LABEL = { nl: "7 dagen", en: "7 days" } as const;

/** ISO timestamp before which a still-unconfirmed row is expired. */
export const unconfirmedCutoff = (now = Date.now()): string =>
	new Date(now - UNCONFIRMED_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
