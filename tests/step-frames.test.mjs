/**
 * Step photos from the recording.
 *
 * The timestamps are the contract: the chapter list and the photo come from the
 * same `t`, so a wrong parse would put a photo of the wrong moment next to a
 * step and nobody would notice until a reader followed it.
 *
 * The rendering tests need ffmpeg; they skip without it, because CI has no
 * encoder and the parser is what can break silently.
 */
import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { frameArgs, framePlan, parseTimestamp } from "../src/lib/frames.ts";

const run = promisify(execFile);
const SCRIPT = fileURLToPath(new URL("../scripts/step-frames.mjs", import.meta.url));
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const hasFfmpeg = spawnSync(FFMPEG, ["-version"]).status === 0;

test("timestamps parse the way a chapter list writes them", () => {
	assert.equal(parseTimestamp("0:00"), 0);
	assert.equal(parseTimestamp("1:05"), 65);
	assert.equal(parseTimestamp("12:00"), 720);
	assert.equal(parseTimestamp("1:02:03"), 3723);
	assert.equal(parseTimestamp("65"), 65, "a bare number is seconds");

	for (const bad of ["", "abc", "1:", ":30", "1:70", "1:2:3:4", "-5", "1,5"]) {
		assert.equal(parseTimestamp(bad), null, `"${bad}" is not a timestamp`);
	}
});

test("a step without a timestamp is reported, not silently skipped over", () => {
	const { frames, missing } = framePlan({
		slug: "soesjes",
		steps: [
			{ id: "stap-1", t: "0:00" },
			{ id: "stap-2", t: null },
			{ id: "stap-3", t: "2:30" },
		],
	});

	assert.deepEqual(missing, ["stap-2"]);
	assert.deepEqual(
		frames.map((frame) => [frame.file, frame.seconds]),
		[
			["soesjes/stap-1.jpg", 0],
			["soesjes/stap-3.jpg", 150],
		],
	);
});

test("ffmpeg seeks before reading, and never upscales", () => {
	const args = frameArgs({ video: "v.mp4", seconds: 65, output: "out.jpg", width: 1200 });
	assert.ok(args.indexOf("-ss") < args.indexOf("-i"), "seek before input");
	assert.equal(args[args.indexOf("-ss") + 1], "65");
	assert.match(args.join(" "), /scale='min\(1200,iw\)':-2/);
	assert.equal(args.at(-1), "out.jpg");
});

test("a 3-second test recording yields one frame per step, and a second run skips them", { skip: !hasFfmpeg && "no ffmpeg on PATH" }, async () => {
	const root = mkdtempSync(join(tmpdir(), "bakmark-frames-"));
	const folder = join(root, "recipes");
	mkdirSync(folder, { recursive: true });
	mkdirSync(join(root, "opnames"), { recursive: true });

	const recipe = {
		slug: "soesjes",
		steps: [
			{ id: "stap-1", t: "0:00" },
			{ id: "stap-2", t: "0:02" },
			{ id: "stap-3", t: null },
		],
	};
	writeFileSync(join(folder, "soesjes.json"), JSON.stringify(recipe));

	const video = join(root, "opnames", "soesjes.mp4");
	await run(FFMPEG, [
		"-hide_banner", "-loglevel", "error",
		"-f", "lavfi", "-i", "testsrc=size=320x180:rate=10:duration=4",
		"-pix_fmt", "yuv420p", video,
	]);

	const env = { ...process.env, FFMPEG };
	const first = await run(process.execPath, ["--experimental-strip-types", SCRIPT, "soesjes", "--video", video], {
		cwd: root,
		env,
	});

	assert.match(first.stdout, /2 written, 0 already there, 0 failed/);
	assert.match(first.stdout, /no timestamp: soesjes:stap-3/);

	const written = readdirSync(join(root, "public", "fotos", "soesjes")).sort();
	assert.deepEqual(written, ["stap-1.jpg", "stap-2.jpg"]);

	// A JPEG starts with FF D8 and ends with FF D9; a truncated frame is neither.
	for (const file of written) {
		const bytes = readFileSync(join(root, "public", "fotos", "soesjes", file));
		assert.equal(bytes[0], 0xff);
		assert.equal(bytes[1], 0xd8);
		assert.equal(bytes.at(-2), 0xff);
		assert.equal(bytes.at(-1), 0xd9);
	}

	const second = await run(process.execPath, ["--experimental-strip-types", SCRIPT, "soesjes", "--video", video], {
		cwd: root,
		env,
	});
	assert.match(second.stdout, /0 written, 2 already there, 0 failed/, "re-running writes nothing new");

	const forced = await run(
		process.execPath,
		["--experimental-strip-types", SCRIPT, "soesjes", "--video", video, "--force"],
		{ cwd: root, env },
	);
	assert.match(forced.stdout, /2 written/, "--force rebuilds the set");

	rmSync(root, { recursive: true, force: true });
});

test("a recipe whose steps have no timestamps says so instead of writing nothing", { skip: !hasFfmpeg && "no ffmpeg on PATH" }, async () => {
	const root = mkdtempSync(join(tmpdir(), "bakmark-frames-gap-"));
	mkdirSync(join(root, "recipes"), { recursive: true });
	mkdirSync(join(root, "opnames"), { recursive: true });
	writeFileSync(
		join(root, "recipes", "slagroom.json"),
		JSON.stringify({ slug: "slagroom", steps: [{ id: "stap-1", t: null }] }),
	);
	const video = join(root, "opnames", "slagroom.mp4");
	await run(FFMPEG, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=10:duration=2", "-pix_fmt", "yuv420p", video]);

	const result = await run(process.execPath, ["--experimental-strip-types", SCRIPT, "slagroom", "--video", video], {
		cwd: root,
		env: { ...process.env, FFMPEG },
	});
	assert.match(result.stdout, /0 written.*no timestamp: slagroom:stap-1/);
	assert.equal(existsSync(join(root, "public", "fotos")), false, "no folder for an empty set");

	rmSync(root, { recursive: true, force: true });
});
