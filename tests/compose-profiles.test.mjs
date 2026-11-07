/**
 * Which services a deploy starts.
 *
 * `docker compose up` in staging or production starts every service without a
 * profile. Mailpit is a development catcher: on the server it is a container
 * nobody uses, holding two ports, for as long as the box lives. A profile is the
 * only thing that keeps it out, and removing one line would bring it back
 * silently.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const compose = readFileSync(new URL("../compose.yaml", import.meta.url), "utf8");
const dockerignore = readFileSync(new URL("../.dockerignore", import.meta.url), "utf8");

/** The lines of one top-level service block. */
const service = (name) => {
	const lines = compose.split("\n");
	const start = lines.findIndex((line) => line === `  ${name}:`);
	assert.notEqual(start, -1, `compose.yaml has no service ${name}`);
	const body = [];
	for (const line of lines.slice(start + 1)) {
		if (/^ {0,2}\S/.test(line) && !line.startsWith("   ")) break;
		body.push(line);
	}
	return body.join("\n");
};

test("mailpit only runs in the dev profile", () => {
	assert.match(service("mailpit"), /profiles: \["dev"\]/);
});

test("the app itself runs everywhere", () => {
	assert.doesNotMatch(
		service("bakmark"),
		/profiles:/,
		"a profile on the app service would keep it out of a deploy",
	);
});

test("start.sh enables the dev profile for local runs only", () => {
	const start = readFileSync(new URL("../start.sh", import.meta.url), "utf8");
	assert.match(start, /--profile dev/);
	assert.match(start, /BAKMARK_ENV" = "local"/);
});

test("the build context leaves the footage on the host", () => {
	// videos/ is tens of gigabytes. In the context it does not slow the build
	// down, it stalls it: the daemon receives every byte before the first
	// instruction runs.
	assert.match(
		dockerignore,
		/^videos$/m,
		"videos/ in the build context turns every --build into a copy of the footage",
	);
	assert.match(dockerignore, /^node_modules$/m);
	assert.match(dockerignore, /^\.git$/m);
	assert.match(dockerignore, /^data$/m);
});
