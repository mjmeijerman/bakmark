/**
 * Route shape.
 *
 * The front page is the catalogue: no separate listing page, and the old
 * /recepten URL has to keep working with a real 301 rather than a 404 or a
 * second copy of the same list. Both are easy to undo by accident, so they are
 * pinned here.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { withServer } from "./helpers/server.mjs";

const get = (url) => fetch(url, { redirect: "manual" });

test("the front page is the catalogue, in both languages", async () => {
	await withServer(async ({ base }) => {
		for (const [url, heading] of [
			["/", "Welkom bij Bakmark"],
			["/en", "Welcome to Bakmark"],
		]) {
			const response = await get(`${base}${url}`);
			assert.equal(response.status, 200);
			const html = await response.text();
			assert.match(html, new RegExp(`<h1>${heading}</h1>`), `${url} opens with the brand heading`);
			assert.match(html, /data-results/, `${url} carries the recipe grid`);
			assert.match(html, /data-filter-bar/, `${url} carries the search and filters`);
		}
	});
});

test("/recepten 301s to the front page, /en/recipes to /en", async () => {
	await withServer(async ({ base }) => {
		for (const [url, target] of [
			["/recepten", "/"],
			["/en/recipes", "/en"],
		]) {
			const response = await get(`${base}${url}`);
			assert.equal(response.status, 301, `${url} must be a permanent redirect`);
			assert.equal(new URL(response.headers.get("location") ?? "", "http://x").pathname, target);
		}
	});
});

test("a recipe keeps its own page under /recepten/", async () => {
	await withServer(async ({ base }) => {
		const response = await get(`${base}/recepten/soesjes`);
		assert.equal(response.status, 200, "redirecting the index must not swallow the detail pages");
	});
});
