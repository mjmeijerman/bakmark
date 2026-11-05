/**
 * The codes on a printed sheet.
 *
 * A QR that does not scan is worse than no QR: it looks like an answer and
 * gives nothing. There is no decoder in the test environment, so this compares
 * the drawn pattern with an independently generated one, module for module. A
 * shifted path, a missing quiet zone or a lost row fails here instead of in a
 * kitchen.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import qrcode from "qrcode-generator";
import { TIP_ANCHOR, videoWatchUrl } from "../src/lib/recipes.ts";
import { withServer } from "./helpers/server.mjs";

/** `<svg class="qr" … data-text="…" …><path d="M4 4h1v1h-1z…">` → modules. */
const decodeDrawing = (svg) => {
	const viewBox = Number(svg.match(/viewBox="0 0 (\d+) \1"/)?.[1]);
	const text = svg.match(/data-text="([^"]*)"/)?.[1] ?? "";
	const path = svg.match(/<path d="([^"]*)"/)?.[1] ?? "";

	const dark = new Set();
	for (const [, x, y] of path.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) dark.add(`${x},${y}`);

	return { viewBox, text, dark };
};

const drawExpected = (text) => {
	const qr = qrcode(0, "M");
	qr.addData(text);
	qr.make();
	const n = qr.getModuleCount();
	const dark = new Set();
	for (let row = 0; row < n; row++) {
		for (let column = 0; column < n; column++) {
			if (qr.isDark(row, column)) dark.add(`${column + 4},${row + 4}`);
		}
	}
	return { modules: n, dark };
};

const qrSvgs = (html) => html.match(/<svg class="qr"[\s\S]*?<\/svg>/g) ?? [];

test("the printed tip code matches an independently generated one, module for module", async () => {
	await withServer(async ({ base }) => {
		const html = await (await fetch(`${base}/recepten/soesjes`)).text();
		const codes = qrSvgs(html);
		assert.equal(codes.length, 1, "no video is published yet, so only the tip code prints");

		const drawn = decodeDrawing(codes[0]);
		const expected = drawExpected(drawn.text);

		assert.match(drawn.text, /\/recepten\/soesjes#een-fooi$/, "the code points at the tip block");
		assert.equal(
			drawn.viewBox,
			expected.modules + 8,
			"viewBox is the module grid plus the four-module quiet zone",
		);
		assert.equal(drawn.dark.size, expected.dark.size, "same number of dark modules");
		for (const module of expected.dark) {
			assert.ok(drawn.dark.has(module), `missing module ${module}`);
		}
	});
});

test("the tip code and its anchor exist in both languages", async () => {
	await withServer(async ({ base }) => {
		for (const [url, caption] of [
			["/recepten/soesjes", "Een fooi? Scan en kies zelf."],
			["/en/recipes/soesjes", "A tip? Scan and choose."],
		]) {
			const html = await (await fetch(`${base}${url}`)).text();
			assert.ok(html.includes(`id="${TIP_ANCHOR}"`), `${url} has the anchor the code points at`);
			assert.ok(html.includes(`<p>${caption}</p>`), `${url} captions the code`);
		}
	});
});

test("the printed strip is print-only, so a phone never shows a QR for a page it is on", async () => {
	await withServer(async ({ base }) => {
		const html = await (await fetch(`${base}/recepten/soesjes`)).text();
		assert.match(html, /<div class="print-only qr-strip">/);
	});
});

test("a chapter offset makes the code open the part, not the start of the video", () => {
	assert.equal(
		videoWatchUrl({ youtube_id: "abc123" }),
		"https://www.youtube.com/watch?v=abc123",
	);
	assert.equal(
		videoWatchUrl({ youtube_id: "abc123", start: 735 }),
		"https://www.youtube.com/watch?v=abc123&t=735s",
	);
});
