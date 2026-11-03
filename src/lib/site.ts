/**
 * Where this site is served, and whether search engines may index it.
 *
 * One place decides both, because they are the same question: staging exists
 * to be looked at by people who were given the address, and production exists
 * to be found. A staging site that is indexable competes with production for
 * its own content, which is worse than not being listed at all.
 *
 *   SITE_URL               the public origin, e.g. https://bakmark.nl
 *   SITE_INDEXABLE=1       allow indexing; anything else means noindex + robots
 *
 * The default is NOT indexable. Forgetting the variable makes a site silent,
 * which is recoverable; forgetting it the other way puts a staging copy in
 * Google, which is not.
 */

/** Public origin without a trailing slash. Absolute URLs are built from it. */
export const siteUrl = (): string =>
	(process.env.SITE_URL?.trim() || "http://localhost:4321").replace(/\/+$/, "");

/** True only when explicitly enabled. */
export const isIndexable = (): boolean => process.env.SITE_INDEXABLE === "1";

/** `<link rel="canonical">` and hreflang need an absolute URL. */
export const absolute = (path: string): string => `${siteUrl()}${path}`;
