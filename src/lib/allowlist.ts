/**
 * Staging allowlist.
 *
 * A staging deployment runs the real form, the real database and often the
 * real mail path. That makes it the one place where a stray test signup can
 * mail a stranger, so on staging only a known set of domains may subscribe.
 *
 *   SIGNUP_ALLOWED_DOMAINS=markmeijerman.eu,mail-tester.com
 *
 * Empty or unset means no restriction: that is development and production.
 * The list is a hard gate, not a warning: an address outside it is refused the
 * same way a malformed one is, because "accepted but never mailed" would be a
 * worse lie than a clear rejection.
 */

const parse = (value: string | undefined): string[] =>
	(value ?? "")
		.split(",")
		.map((entry) => entry.trim().toLowerCase().replace(/^@/, ""))
		.filter((entry) => entry.length > 0);

/** Domains an address must belong to, or an empty list when unrestricted. */
export const allowedDomains = (): string[] => parse(process.env.SIGNUP_ALLOWED_DOMAINS);

export const isRestricted = (): boolean => allowedDomains().length > 0;

/**
 * True when `email` may sign up here. Subdomains are allowed: an address at
 * `x.mail-tester.com` is still on mail-tester, and the check is about who can
 * receive the mail, not about the exact host label.
 */
export const isAllowed = (email: string): boolean => {
	const allowed = allowedDomains();
	if (allowed.length === 0) return true;

	const at = email.lastIndexOf("@");
	if (at < 1) return false;
	const domain = email.slice(at + 1).toLowerCase();

	return allowed.some((entry) => domain === entry || domain.endsWith(`.${entry}`));
};
