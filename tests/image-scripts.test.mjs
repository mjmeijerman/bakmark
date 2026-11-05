/**
 * The scripts the container runs, and the sources they need.
 *
 * The runtime image copies a hand-written list of `src/lib` files — everything
 * else is left behind to keep the image small. A script that gains an import
 * nobody added to that list does not fail at build time: it fails at 04:17 on
 * the server, in a log nobody is watching. So the list and the imports are
 * compared here.
 *
 * Only scripts that run *inside* the image count. `step-frames` and `chapters`
 * are host tools: ffmpeg is not in the image, and neither are the recordings.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("..", import.meta.url);
const dockerfile = readFileSync(new URL("Dockerfile", root), "utf8");

/** Files listed on the `COPY --from=build /app/src/lib/...` line. */
const copied = new Set(
	[...dockerfile.matchAll(/\/app\/src\/lib\/([\w.-]+\.ts)/g)].map((match) => match[1]),
);

const inImage = ["purge.mjs", "bounces.mjs", "newsletter.mjs"];

test("every lib a container script imports is copied into the image", () => {
	const missing = new Set();

	for (const script of inImage) {
		const source = readFileSync(new URL(`scripts/${script}`, root), "utf8");
		for (const [, name] of source.matchAll(/\.\.\/src\/lib\/([\w.-]+)\.ts/g)) {
			if (!copied.has(`${name}.ts`)) missing.add(`${script} → ${name}.ts`);
		}
	}

	assert.deepEqual([...missing].sort(), [], "the image would fail at run time, not at build time");
});

test("the list has no leftovers: every copied file is reachable", () => {
	// Transitively: newsletter.mjs needs newsletter.ts, which needs mail.ts and
	// i18n.ts. Those are in the image because they are pulled in, not because a
	// script names them.
	const needed = new Set();
	const queue = [];

	for (const script of inImage) {
		const source = readFileSync(new URL(`scripts/${script}`, root), "utf8");
		for (const [, name] of source.matchAll(/\.\.\/src\/lib\/([\w.-]+)\.ts/g)) queue.push(name);
	}

	while (queue.length > 0) {
		const name = queue.shift();
		if (needed.has(name)) continue;
		needed.add(name);

		let source;
		try {
			source = readFileSync(new URL(`src/lib/${name}.ts`, root), "utf8");
		} catch {
			continue; // a package import, not a file we ship
		}
		for (const [, next] of source.matchAll(/"\.\/([\w.-]+)\.ts"/g)) queue.push(next);
	}

	const unused = [...copied]
		.map((file) => file.replace(/\.ts$/, ""))
		.filter((name) => !needed.has(name));
	assert.deepEqual(unused, [], "a source file shipped with no script that reads it");
});
