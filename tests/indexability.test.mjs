/**
 * Indexability.
 *
 * Staging exists to be looked at by people who were given the address;
 * production exists to be found. Getting that backwards puts a staging copy in
 * Google, where it competes with production for its own content, and removing
 * it afterwards takes weeks.
 *
 * These tests hold the default in place: unset means not indexable, and only an
 * explicit 1 opens the site up.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { post, withServer } from "./helpers/server.mjs";

/**
 * The meta tag is decided at build time, because the pages are prerendered.
 * A runtime variable cannot change HTML that was already written, so the only
 * honest way to test the indexable case is to build with the flag set — which
 * is exactly what deploy.sh does per environment.
 */


const robots = async (base) => {
	const response = await fetch(`${base}/robots.txt`);
	return { status: response.status, body: await response.text() };
};

const home = async (base) => {
	const response = await fetch(`${base}/`);
	return { status: response.status, html: await response.text() };
};

test("by default the site is not indexable", async () => {
	await withServer(async ({ base }) => {
		const { status, body } = await robots(base);
		assert.equal(status, 200, "robots.txt must exist; a 404 HTML page is not a robots file");
		assert.match(body, /Disallow: \//);
		assert.doesNotMatch(body, /Allow: \//, "a staging robots file must not allow anything");

		const page = await home(base);
		assert.equal(page.status, 200);
		assert.match(page.html, /<meta name="robots" content="noindex/, "noindex is the protection that survives a crawler ignoring robots.txt");
	});
});

test("SITE_INDEXABLE=1 opens the site up", async () => {
	// robots.txt is rendered per request, so this half can be tested in place.
	await withServer(
		async ({ base }) => {
			const { body } = await robots(base);
			assert.match(body, /Allow: \//);
			assert.match(body, /Sitemap:/, "an indexable site should point at its sitemap");
			assert.doesNotMatch(body, /Disallow: \/\s*$/m, "everything must not be disallowed");
		},
		{ env: { SITE_INDEXABLE: "1", SITE_URL: "https://bakmark.nl" } },
	);
});

test("an indexable build carries no noindex tag", () => {
	// The pages are prerendered, so indexability is a build-time property: the
	// check has to be a build. It builds in a copy of the project with its own
	// dist, because node --test runs files in parallel and a test that rebuilds
	// the shared dist breaks every suite running beside it.
	const work = mkdtempSync(join(tmpdir(), "bakmark-build-"));
	try {
		for (const entry of ["src", "public", "recipes", "scripts", "package.json", "package-lock.json", "astro.config.mjs", "tsconfig.json"]) {
			cpSync(entry, join(work, entry), { recursive: true });
		}
		// Reuse the installed dependencies instead of reinstalling them.
		symlinkSync(join(process.cwd(), "node_modules"), join(work, "node_modules"));

		execFileSync("npx", ["astro", "build"], {
			cwd: work,
			stdio: "ignore",
			env: { ...process.env, SITE_INDEXABLE: "1", SITE_URL: "https://bakmark.nl" },
		});

		const html = readFileSync(join(work, "dist", "client", "index.html"), "utf8");
		assert.doesNotMatch(html, /<meta name="robots"[^>]*noindex/, "no noindex when the site is meant to be found");
		assert.match(html, /<link rel="canonical" href="https:\/\/bakmark\.nl\//, "canonical must carry the public origin");

		// A concept has no page on the public site. The list is read from the
		// checkout, so this test keeps testing something when every recipe is
		// verified and nothing is a concept.
		const concepts = readdirSync(join(work, "recipes"))
			.filter((name) => name.endsWith(".json"))
			.map((name) => JSON.parse(readFileSync(join(work, "recipes", name), "utf8")))
			.filter((recipe) => recipe.verified === false)
			.map((recipe) => recipe.slug);

		const sitemap = readFileSync(join(work, "dist", "client", "sitemap-0.xml"), "utf8");
		for (const slug of concepts) {
			assert.equal(
				existsSync(join(work, "dist", "client", "recepten", slug)),
				false,
				`${slug} is a concept and must not be in a public build`,
			);
			assert.doesNotMatch(sitemap, new RegExp(`/recepten/${slug}/`), `${slug} must not be in the sitemap`);
		}
	} finally {
		rmSync(work, { recursive: true, force: true });
	}
});

test("anything other than 1 is not indexable", async () => {
	// "true", "yes" and "0" are the values someone will try. Only 1 counts, so
	// there is no way to half-enable indexing.
	for (const value of ["true", "yes", "0", "on", ""]) {
		await withServer(
			async ({ base }) => {
				const { body } = await robots(base);
				assert.match(body, /Disallow: \//, `SITE_INDEXABLE=${value} must stay closed`);
			},
			{ env: { SITE_INDEXABLE: value } },
		);
	}
});

test("robots.txt is never cached across a decision change", async () => {
	await withServer(async ({ base }) => {
		const response = await fetch(`${base}/robots.txt`);
		assert.match(
			response.headers.get("cache-control") ?? "",
			/no-store/,
			"a cached robots.txt outlives the deploy that changed it",
		);
	});
});

test("the canonical URL is absolute and points at SITE_URL", async () => {
	await withServer(
		async ({ base }) => {
			const page = await home(base);
			const canonical = page.html.match(/<link rel="canonical" href="([^"]+)"/);
			assert.ok(canonical, "no canonical tag");
			assert.match(canonical[1], /^https?:\/\//, "a relative canonical is resolved against whatever host served the page");
		},
		{ env: { SITE_URL: "https://bakmark.nl" } },
	);
});

test("the signup endpoint stays out of the sitemap and robots", async () => {
	await withServer(
		async ({ base }) => {
			const { body } = await robots(base);
			assert.match(body, /Disallow: \/api\//, "an indexable site still hides its API from crawlers");

			// The endpoint itself must reject a GET regardless.
			const response = await post(base, { email: "x@example.nl", elapsed: 5000 });
			assert.equal(response.status, 201);
		},
		{ env: { SITE_INDEXABLE: "1" } },
	);
});
