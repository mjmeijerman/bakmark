/**
 * env.dist is the only place the environment is written down.
 *
 * A variable read by the code but absent from env.dist is invisible until
 * someone needs it in a hurry, which is the worst moment. This test compares
 * the two lists and fails on a missing entry.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();

/** Every env var name a file reads, however it is spelled. */
const namesIn = (text) => {
	const found = new Set();
	for (const match of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) found.add(match[1]);
	for (const match of text.matchAll(/process\.env\["([A-Z][A-Z0-9_]*)"\]/g)) found.add(match[1]);
	return found;
};

const files = (dir) => {
	const out = [];
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) out.push(...files(path));
		else if (/\.(ts|astro|mjs|js)$/.test(entry)) out.push(path);
	}
	return out;
};

const readAll = (paths) => paths.map((path) => readFileSync(path, "utf8")).join("\n");

test("every variable the app reads is documented in env.dist", () => {
	const app = readAll(files(join(ROOT, "src")));
	const scripts = readAll(files(join(ROOT, "scripts")));
	const composed = readFileSync(join(ROOT, "compose.yaml"), "utf8");

	// Compose interpolation: ${NAME} and ${NAME:-default}.
	const composeNames = new Set(
		[...composed.matchAll(/\$\{([A-Z][A-Z0-9_]*)/g)].map((match) => match[1]),
	);

	const used = new Set([...namesIn(app), ...namesIn(scripts), ...composeNames]);

	// NODE_ENV is set by the container, not by a person; it needs no entry.
	used.delete("NODE_ENV");

	const dist = readFileSync(join(ROOT, "env.dist"), "utf8");
	const documented = new Set(
		[...dist.matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]),
	);

	const missing = [...used].filter((name) => !documented.has(name)).sort();
	assert.deepEqual(missing, [], `env.dist is missing: ${missing.join(", ")}`);
});

test("env.dist documents nothing the code no longer reads", () => {
	// A stale entry is a lie that survives because nobody checks it.
	const app = readAll(files(join(ROOT, "src")));
	const scripts = readAll(files(join(ROOT, "scripts")));
	const composed = readFileSync(join(ROOT, "compose.yaml"), "utf8");
	const start = readFileSync(join(ROOT, "start.sh"), "utf8");

	const used = new Set([
		...namesIn(app),
		...namesIn(scripts),
		...[...composed.matchAll(/\$\{([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]),
		...[...start.matchAll(/\$\{?([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]),
	]);
	used.add("NODE_ENV");

	const dist = readFileSync(join(ROOT, "env.dist"), "utf8");
	const documented = [...dist.matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]);

	const stale = documented.filter((name) => !used.has(name)).sort();
	assert.deepEqual(stale, [], `env.dist mentions variables nothing reads: ${stale.join(", ")}`);
});
