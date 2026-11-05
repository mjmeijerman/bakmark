/**
 * The YouTube description for one video, chapters included.
 *
 *   npm run chapters -- soesjes
 *   npm run chapters -- soesjes > ~/beschrijving.txt
 *
 * Reads `recipes/<slug>.json` and prints what goes into the description field.
 * Refuses, with the reason, when YouTube would ignore the chapter list: fewer
 * than three chapters, a first chapter that is not 0:00, a chapter shorter than
 * ten seconds, or a step without a timestamp.
 *
 * The same checks run in the test suite for every recipe whose video is marked
 * `gepubliceerd`, so a broken list cannot reach a video announcement.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chapterPlan, chapterProblems, videoDescription } from "../src/lib/chapters.ts";

const slug = process.argv.slice(2).find((arg) => !arg.startsWith("-"));
if (!slug) {
	console.error("[chapters] which recipe? npm run chapters -- soesjes");
	process.exit(1);
}

const file = join(process.cwd(), "recipes", `${slug}.json`);
let recipe;
try {
	recipe = JSON.parse(readFileSync(file, "utf8"));
} catch {
	console.error(`[chapters] no recipe at ${file}`);
	process.exit(1);
}

const plan = chapterPlan(recipe);
const problems = chapterProblems(plan);

if (problems.length > 0) {
	console.error(`[chapters] ${recipe.slug}: YouTube would ignore this list.`);
	for (const problem of problems) console.error(`  - ${problem}`);
	console.error("  Fill in `t` on the steps (and `video.status` once it is truly live).");
	process.exit(1);
}

console.log(
	videoDescription({
		recipe,
		siteUrl: process.env.SITE_URL?.trim() || "http://localhost:4321",
	}),
);
