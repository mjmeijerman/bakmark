import type { APIRoute } from "astro";
import { isIndexable, siteUrl } from "../lib/site";

export const prerender = false;

/**
 * robots.txt, decided by SITE_INDEXABLE.
 *
 * A `noindex` meta tag is the real protection, but this is what a crawler reads
 * first, and a staging site that answers "nothing to see" costs one request
 * instead of a page fetch. Both are emitted because neither is reliable alone:
 * a crawler that ignores robots.txt still sees the meta tag, and a page that
 * slips through without the tag is still blocked here.
 */
export const GET: APIRoute = () => {
	const body = isIndexable()
		? [
				"User-agent: *",
				"Allow: /",
				"",
				// The signup endpoint is not a page; keep crawlers off it.
				"Disallow: /api/",
				"",
				`Sitemap: ${siteUrl()}/sitemap.xml`,
			].join("\n")
		: [
				"# Staging or otherwise not for indexing.",
				"User-agent: *",
				"Disallow: /",
			].join("\n");

	return new Response(`${body}\n`, {
		headers: {
			"content-type": "text/plain; charset=utf-8",
			// A cached robots.txt outlives the decision that produced it.
			"cache-control": "no-store",
		},
	});
};
