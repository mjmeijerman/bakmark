/**
 * The video on the recipe page, and the way into it from a step.
 *
 * A published recipe gets an embed behind a click, and every step gets a link to
 * its own second in that recording. Both are silent when the video is not public
 * yet, which is why the page half of this file skips until one is.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { allRecipes, videoMoment, videoMomentUrl } from "../src/lib/recipes.ts";
import { withServer } from "./helpers/server.mjs";

const ROOT = process.cwd();

const published = allRecipes().filter(
	(recipe) => recipe.video?.status === "gepubliceerd" && recipe.video.youtube_id,
);

test("a step lands on its own second, a chapter offset included", () => {
	assert.equal(videoMoment(undefined, "0:44"), 44);
	assert.equal(videoMoment({ start: 210 }, "0:44"), 254, "a part inside a longer recording");
	assert.equal(videoMoment({ start: 0 }, "1:02:03"), 3723);
	assert.equal(videoMoment(undefined, null), null, "a step without a timestamp has no moment");
	assert.equal(videoMoment(undefined, "nonsense"), null);
});

test("the step link points at YouTube, at that second", () => {
	assert.equal(
		videoMomentUrl({ youtube_id: "abc123", start: 0 }, "0:44"),
		"https://www.youtube.com/watch?v=abc123&t=44s",
	);
	assert.equal(
		videoMomentUrl({ youtube_id: "abc123", start: 210 }, "0:44"),
		"https://www.youtube.com/watch?v=abc123&t=254s",
	);
	assert.equal(videoMomentUrl({ youtube_id: "abc123" }, null), null);
});

test("a published video can actually be embedded and linked", () => {
	for (const recipe of published) {
		assert.ok(
			recipe.steps.every((step) => step.t !== null),
			`${recipe.slug}: a published video needs a timestamp on every step`,
		);
		assert.ok(
			existsSync(join(ROOT, "public", "posters", `${recipe.slug}.jpg`)),
			`${recipe.slug}: no poster at public/posters/${recipe.slug}.jpg`,
		);
	}
});

test("the page shows the poster, not a YouTube request", {
	skip: published.length === 0 ? "no recipe has a published video yet" : false,
}, async () => {
	await withServer(async ({ base }) => {
		const recipe = published[0];
		const html = await (await fetch(`${base}/recepten/${recipe.slug}`)).text();
		const id = recipe.video.youtube_id;

		assert.match(html, /data-video data-embed="https:\/\/www\.youtube-nocookie\.com\/embed\//);
		assert.match(html, new RegExp(`/embed/${id}`));
		assert.match(html, /class="video-play"/, "there is a button to start it");
		assert.match(html, /posters\//, "and a poster of our own");

		const step = recipe.steps.find((entry) => entry.t !== null);
		const seconds = videoMoment(recipe.video, step.t);
		assert.ok(seconds !== null);
		assert.match(
			html,
			new RegExp(`data-seek="${seconds}"`),
			"a step links to its own moment",
		);
		// Astro escapes the ampersand in the attribute, as HTML requires.
		assert.match(html, new RegExp(`watch\\?v=${id}&amp;t=${seconds}s`));
	});
});

test("the overview shows the poster a recipe has", async () => {
	await withServer(async ({ base }) => {
		const html = await (await fetch(`${base}/recepten`)).text();
		assert.match(html, /class="recipe-card-photo"/, "a recipe with a poster shows the photo");
		assert.match(html, /src="\/posters\/[a-z-]+\.jpg"/);
		assert.match(html, /class="placeholder-box"/, "one without a poster keeps the placeholder");
	});
});
