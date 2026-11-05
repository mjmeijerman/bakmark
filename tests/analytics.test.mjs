/**
 * The visit counter, which is off unless someone turns it on.
 *
 * Two failures matter here: a tracker that appears in a build nobody configured,
 * and a privacy page that claims there is none while one is running. The second
 * is a legal statement, so it is generated from the same two variables.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { analytics } from "../src/lib/analytics.ts";
import { withServer } from "./helpers/server.mjs";

const withEnv = (vars, run) => {
	const saved = {};
	for (const [key, value] of Object.entries(vars)) {
		saved[key] = process.env[key];
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
	try {
		return run();
	} finally {
		for (const [key, value] of Object.entries(saved)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	}
};

test("nothing is configured by default", () => {
	withEnv({ UMAMI_SCRIPT_URL: undefined, UMAMI_WEBSITE_ID: undefined }, () => {
		assert.equal(analytics(), null);
	});
});

test("half a configuration is no configuration", () => {
	withEnv({ UMAMI_SCRIPT_URL: "https://analytics.example.nl/script.js", UMAMI_WEBSITE_ID: undefined }, () => {
		assert.equal(analytics(), null, "a script without an id counts nothing and must not load");
	});
	withEnv({ UMAMI_SCRIPT_URL: undefined, UMAMI_WEBSITE_ID: "abc-123" }, () => {
		assert.equal(analytics(), null);
	});
});

test("both set means a collector", () => {
	withEnv(
		{ UMAMI_SCRIPT_URL: "https://analytics.example.nl/script.js", UMAMI_WEBSITE_ID: "abc-123" },
		() => {
			assert.deepEqual(analytics(), {
				scriptUrl: "https://analytics.example.nl/script.js",
				websiteId: "abc-123",
			});
		},
	);
});

test("a build without a collector ships no script tag and no analytics paragraph", async () => {
	await withServer(async ({ base }) => {
		const html = await (await fetch(`${base}/privacy`)).text();
		assert.doesNotMatch(html, /umami|analytics\./i, "no tracker in the page");
		assert.doesNotMatch(html, /Bezoekcijfers/);
	});
});
