/**
 * The interactive rescaler.
 *
 * The arithmetic is the whole risk: a wrong factor quietly produces a batch that
 * fits the tin but not the recipe, and nothing on the page looks broken. The
 * browser half is the same functions, so what is tested here is what runs.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
	MAX_FACTOR,
	MIN_FACTOR,
	factorForAmount,
	factorForResult,
	factorFromSearch,
	formatAmount,
	round,
	scaledAmount,
	searchFor,
} from "../src/lib/rescale.ts";
import { withServer } from "./helpers/server.mjs";

const milk = { amount: 100, unit: "g", scalable: true };
const salt = { amount: 1.5, unit: "g", scalable: false };

test("a factor multiplies what may scale and nothing else", () => {
	assert.equal(scaledAmount(milk, 2.5), 250);
	assert.equal(scaledAmount(salt, 2.5), 1.5, "a pinch stays a pinch");
	assert.equal(scaledAmount(milk, 1), 100);
});

test("numbers stop where a kitchen scale stops", () => {
	assert.equal(round(1.25), 1.3, "one decimal below ten");
	assert.equal(round(12.4), 12, "whole grams above ten");
	assert.equal(round(0.75), 0.8);
	assert.equal(round(1200), 1200);
});

test("typing into an ingredient gives a factor, or nothing", () => {
	assert.equal(factorForAmount(milk, 250), 2.5);
	assert.equal(factorForAmount(milk, 0), null, "a zero while typing is not a factor");
	assert.equal(factorForAmount(milk, Number.NaN), null, "an empty field is not a factor");
	assert.equal(factorForAmount(salt, 5), null, "an item that does not scale cannot drive");
	assert.equal(factorForAmount({ amount: 0, unit: "g", scalable: true }, 10), null, "no base, no factor");

	assert.equal(factorForAmount(milk, 100000), MAX_FACTOR, "clamped, not multiplied by a thousand");
	assert.equal(factorForAmount(milk, 0.001), MIN_FACTOR);
});

test("asking for a yield gives a factor, or nothing", () => {
	assert.equal(factorForResult(50, 100), 2);
	assert.equal(factorForResult(50, 25), 0.5);
	assert.equal(factorForResult(50, 0), null);
	assert.equal(factorForResult(0, 25), null, "a recipe with no yield cannot be aimed at");
	assert.equal(factorForResult(50, Number.POSITIVE_INFINITY), null);
});

test("`?ref=` and `?result=` reproduce a state, and result wins", () => {
	const bases = { refAmount: 100, resultValue: 50 };

	assert.equal(factorFromSearch("?ref=250", bases), 2.5);
	assert.equal(factorFromSearch("?result=25", bases), 0.5);
	assert.equal(factorFromSearch("?ref=100&result=25", bases), 0.5, "a link that says 25 soesjes means 25");
	assert.equal(
		factorFromSearch("?ref=2,5", bases),
		MIN_FACTOR,
		"a decimal comma is accepted, and a factor under the floor is clamped",
	);
	assert.equal(factorFromSearch("", bases), null);
	assert.equal(factorFromSearch("?ref=abc", bases), null);
});

test("a state is shared as a link that rebuilds it", () => {
	assert.equal(searchFor({ factor: 2.5, drivenBy: "ref", resultValue: 50 }, 100), "?ref=250");
	assert.equal(searchFor({ factor: 2, drivenBy: "result", resultValue: 50 }, 100), "?result=100");
});

test("amounts read the way the recipe writes them", () => {
	assert.equal(formatAmount(2.5, "nl"), "2,5");
	assert.equal(formatAmount(2.5, "en"), "2.5");
	assert.equal(formatAmount(2, "nl"), "2", "no trailing ,0");
});

test("the page carries everything the rescaler needs, and nothing it must add", async () => {
	await withServer(async ({ base }) => {
		const html = await (await fetch(`${base}/recepten/soesjes`)).text();

		assert.match(html, /data-rescale/);
		assert.match(html, /data-result-base="50"/);
		assert.match(html, /data-ref-base="100"/, "the reference ingredient is the first that scales");
		assert.match(html, /data-base="100" data-unit="g" data-scalable="1"/);
		assert.match(html, /data-base="1\.5" data-unit="g" data-scalable="0"/, "salt is marked as fixed");
		assert.match(html, /data-result-input/);
		assert.match(html, /data-result-note="Ongeveer 50 soesjes/, "the sentence about the yield follows it");

		// The field itself is created by the script: without JavaScript there is
		// nothing that looks editable and does nothing.
		assert.doesNotMatch(html, /class="amount-input"/);
	});
});

test("printing keeps the numbers and drops the fields", () => {
	const css = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");
	const print = css.slice(css.indexOf("@media print"));

	assert.match(
		print,
		/\.ingredients \.amount-input \{\s*display: none !important;/,
		"a printed input is a blank line",
	);
	assert.match(print, /\.ingredients li\.is-rescalable \.amount-text \{\s*display: inline;/);
	assert.match(print, /html\[data-rescaled="1"\] \.scale-section/, "a scaled list hides the static table");
});
