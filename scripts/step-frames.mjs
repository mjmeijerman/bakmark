/**
 * One photo per step, pulled out of the recording.
 *
 *   npm run step-frames -- soesjes --video ~/opnames/soesjes.mp4
 *   npm run step-frames -- --all --video ~/opnames/        # one file per slug in a folder
 *
 * Reads `t` from `recipes/<slug>.json` — the same timestamps the chapters come
 * from — and writes `public/fotos/<slug>/<step-id>.jpg`, so page, video
 * description and printed sheet all point at the same moment.
 *
 * Re-runnable: an existing frame is skipped unless `--force`, so adding one step
 * costs one frame, not the whole set.
 *
 * ffmpeg lives on the host, not in the app image: this is a job for the machine
 * that holds the recordings, like `scripts/purge.mjs` is a job for the host's
 * cron. Set FFMPEG=/path/to/ffmpeg when it is not on PATH.
 */
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { frameArgs, framePlan } from "../src/lib/frames.ts";

const run = promisify(execFile);

const FFMPEG = process.env.FFMPEG?.trim() || "ffmpeg";
const RECIPES_DIR = join(process.cwd(), "recipes");

/** `--flag value`, `--flag`, or bare words. Values never start with a dash. */
const options = { video: undefined, out: "public/fotos", width: "1200", force: false, all: false };
const positional = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
	const arg = argv[i];
	if (!arg.startsWith("--")) {
		positional.push(arg);
		continue;
	}
	const name = arg.slice(2);
	const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
	if (name === "force") options.force = true;
	else if (name === "all") options.all = true;
	else if (name in options) options[name] = value;
	else {
		console.error(`[step-frames] unknown option --${name}`);
		process.exit(1);
	}
}

const { force, all } = options;
const width = Number(options.width);
const video = typeof options.video === "string" ? options.video : null;
const slug = positional[0];

if (!video) {
	console.error("[step-frames] which recording? --video ~/opnames/soesjes.mp4");
	process.exit(1);
}
if (!all && !slug) {
	console.error("[step-frames] which recipe? a slug, or --all for every recipe with timestamps");
	process.exit(1);
}
if (!Number.isFinite(width) || width < 100) {
	console.error(`[step-frames] --width ${options.width} is not a width`);
	process.exit(1);
}

const files = all
	? readdirSync(RECIPES_DIR).filter((file) => file.endsWith(".json"))
	: [`${slug}.json`];

const recipes = files
	.filter((file) => existsSync(join(RECIPES_DIR, file)))
	.map((file) => JSON.parse(readFileSync(join(RECIPES_DIR, file), "utf8")))
	.filter((recipe) => Array.isArray(recipe.steps) && recipe.steps.length > 0);

if (recipes.length === 0) {
	console.error(`[step-frames] no recipe with steps for "${slug ?? "--all"}"`);
	process.exit(1);
}

let written = 0;
let skipped = 0;
let failed = 0;
const missing = [];

for (const recipe of recipes) {
	// --all with a folder of recordings: one file per slug, named <slug>.mp4.
	const perSlug = all && existsSync(join(video, `${recipe.slug}.mp4`));
	const source = perSlug ? join(video, `${recipe.slug}.mp4`) : video;

	if (!existsSync(source)) {
		console.error(`[step-frames] ${recipe.slug}: no video at ${source}`);
		failed += 1;
		continue;
	}

	const { frames, missing: gaps } = framePlan(recipe, { outDir: options.out });
	missing.push(...gaps.map((id) => `${recipe.slug}:${id}`));
	if (frames.length === 0) continue;

	for (const frame of frames) {
		const output = join(options.out, frame.file);
		if (existsSync(output) && !force) {
			skipped += 1;
			continue;
		}

		mkdirSync(dirname(output), { recursive: true });
		try {
			await run(FFMPEG, frameArgs({ video: source, seconds: frame.seconds, output, width }));
			written += 1;
			console.log(`[step-frames] ${frame.file} ← ${frame.seconds}s`);
		} catch (error) {
			// One unreadable frame must not abandon the rest of the recipe.
			failed += 1;
			console.error(`[step-frames] ${frame.file} at ${frame.seconds}s failed: ${error.message}`);
		}
	}
}

// One line, always, so a log answers "did it run and what did it do".
console.log(
	`[step-frames] ${written} written, ${skipped} already there, ${failed} failed` +
		(missing.length ? `; no timestamp: ${missing.join(", ")}` : ""),
);

process.exit(failed > 0 ? 1 : 0);
