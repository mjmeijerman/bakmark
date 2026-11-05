/**
 * The YouTube description, chapters included.
 *
 * A chapter list that breaks YouTube's rules is not an error anywhere: the
 * description looks fine and the video simply has no chapters. So the rules are
 * tested here, including the one that matters most — a recipe whose video is
 * marked `gepubliceerd` must have a list that parses.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
	MIN_CHAPTER_SECONDS,
	chapterPlan,
	chapterProblems,
	formatTimestamp,
	videoDescription,
} from "../src/lib/chapters.ts";
import { allRecipes } from "../src/lib/recipes.ts";

const step = (overrides = {}) => ({
	id: "stap-1",
	title: "Mengen",
	duration: 120,
	t: "0:00",
	...overrides,
});

const recipe = (steps, slug = "test") => ({
	slug,
	title: "Testrecept",
	subtitle: "Een test in één take",
	result: { value: 1, unit: "brood" },
	steps,
});

test("timestamps are written the three ways YouTube accepts", () => {
	assert.equal(formatTimestamp(0), "0:00");
	assert.equal(formatTimestamp(65), "1:05");
	assert.equal(formatTimestamp(3723), "1:02:03");
	assert.equal(formatTimestamp(-5), "0:00", "never a negative timestamp");
	assert.equal(formatTimestamp(59.6), "1:00", "rounded, not truncated");
});

test("a long hands-on step becomes five chapters, a long wait stays one", () => {
	const { chapters } = chapterPlan(
		recipe([
			step({ id: "mengen", title: "Mengen", duration: 120, t: "0:00" }),
			step({ id: "kneden", title: "Kneden", duration: 1200, t: "2:00", split: true }),
			step({ id: "rijzen", title: "Rijzen", duration: 1800, t: "22:00" }),
		]),
	);

	assert.deepEqual(
		chapters.map((chapter) => [formatTimestamp(chapter.seconds), chapter.title]),
		[
			["0:00", "Mengen"],
			["2:00", "Kneden"],
			["6:00", "Kneden (deel 2/5)"],
			["10:00", "Kneden (deel 3/5)"],
			["14:00", "Kneden (deel 4/5)"],
			["18:00", "Kneden (deel 5/5)"],
			["22:00", "Rijzen"],
		],
		"twenty minutes of kneading is skippable; thirty minutes of rising is one block",
	);
});

test("a step may bring its own chapter names", () => {
	const { chapters } = chapterPlan(
		recipe([
			step({ id: "kneden", title: "Kneden", duration: 600, t: "0:00", chapters: [
				{ t: "0:00", title: "Kneden tot het deeg samenkomt" },
				{ t: "3:00", title: "Kneden tot het van de kom loslaat" },
				{ t: "7:00", title: "Kneden tot het venster" },
			] }),
		]),
	);

	assert.deepEqual(
		chapters.map((chapter) => chapter.title),
		["Kneden tot het deeg samenkomt", "Kneden tot het van de kom loslaat", "Kneden tot het venster"],
	);
});

test("the three rules YouTube enforces are the three that are checked", () => {
	const tooFew = chapterProblems(chapterPlan(recipe([step(), step({ id: "b", t: "5:00" })])));
	assert.match(tooFew.join(" / "), /2 chapter\(s\); YouTube needs at least 3/);

	const notAtZero = chapterProblems(
		chapterPlan(recipe([step({ t: "0:30" }), step({ id: "b", t: "5:00" }), step({ id: "c", t: "9:00" })])),
	);
	assert.match(notAtZero.join(" / "), /first chapter starts at 0:30, not 0:00/);

	const tooShort = chapterProblems(
		chapterPlan(recipe([step({ t: "0:00" }), step({ id: "b", title: "Snel", duration: 5, t: "0:05" }), step({ id: "c", t: "9:00" })])),
	);
	assert.match(tooShort.join(" / "), new RegExp(`"Mengen" lasts 5s; every chapter needs ${MIN_CHAPTER_SECONDS}s`));
});

test("a step without a timestamp is named, not skipped over", () => {
	const plan = chapterPlan(recipe([step(), step({ id: "zonder-tijd", t: null })]));
	assert.deepEqual(plan.missing, ["zonder-tijd"]);
	assert.match(chapterProblems(plan).join(" / "), /no timestamp for: zonder-tijd/);
});

test("two chapters at the same second collapse into one", () => {
	const { chapters } = chapterPlan(
		recipe([step({ t: "0:00" }), step({ id: "b", t: "0:00" }), step({ id: "c", t: "9:00" })]),
	);
	assert.equal(chapters.length, 2);
});

test("the description carries the chapters and a link to the recipe", () => {
	const text = videoDescription({
		recipe: recipe([step(), step({ id: "b", t: "2:00" }), step({ id: "c", t: "22:00" })]),
		siteUrl: "https://bakmark.nl",
	});

	assert.match(text, /^Testrecept — Een test in één take/);
	assert.match(text, /\n0:00 Mengen\n/);
	assert.match(text, /https:\/\/bakmark\.nl\/recepten\/test/);
	// Every chapter line starts with a timestamp, which is how YouTube finds them.
	const chapterLines = text.split("\n").filter((line) => /^\d+:\d\d(:\d\d)? \S/.test(line));
	assert.equal(chapterLines.length, 3);
});

test("a recipe whose video is published must have chapters that parse", () => {
	const broken = allRecipes().filter((entry) => {
		if (entry.video?.status !== "gepubliceerd") return false;
		return chapterProblems(chapterPlan(entry)).length > 0;
	});

	assert.deepEqual(
		broken.map((entry) => entry.slug),
		[],
		"a published video with a broken chapter list reaches YouTube as a description without chapters",
	);
});
