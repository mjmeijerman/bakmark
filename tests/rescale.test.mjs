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
	approxPieces,
	approxText,
	clampedResult,
	factorForAmount,
	factorForResult,
	factorFromSearch,
	formatAmount,
	round,
	scaledAmount,
	searchFor,
	substituteGrams,
	substituteText,
	typedAmountFactor,
	unitFor,
} from "../src/lib/rescale.ts";
import { withServer } from "./helpers/server.mjs";

const milk = { amount: 100, unit: "g", scalable: true };
const salt = { amount: 1.5, unit: "g", scalable: false };
const vanilla = { amount: 1, unit: "stuk", scalable: true, step: 0.5 };

test("a factor multiplies what may scale and nothing else", () => {
	assert.equal(scaledAmount(milk, 2.5), 250);
	assert.equal(scaledAmount(salt, 2.5), 1.5, "a pinch stays a pinch");
	assert.equal(scaledAmount(milk, 1), 100);
});

test("a vanilla pod halves, and never becomes less than half", () => {
	assert.equal(scaledAmount(vanilla, 1), 1);
	assert.equal(scaledAmount(vanilla, 1.5), 1.5);
	assert.equal(scaledAmount(vanilla, 2), 2);
	assert.equal(scaledAmount(vanilla, 0.5), 0.5);
	assert.equal(scaledAmount(vanilla, 0.25), 0.5, "half is the floor: a quarter pod is not a thing");
	assert.equal(scaledAmount(vanilla, 0.1), 0.5);
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

test("a typed amount says when it was pushed to a bound", () => {
	assert.equal(typedAmountFactor(milk, 250)?.factor, 2.5);
	assert.equal(typedAmountFactor(milk, 250)?.clamped, null);

	const small = typedAmountFactor(milk, 1);
	assert.equal(small?.factor, MIN_FACTOR);
	assert.equal(small?.clamped, "min", "the UI has to be able to explain this");

	const huge = typedAmountFactor(milk, 99_999);
	assert.equal(huge?.factor, MAX_FACTOR);
	assert.equal(huge?.clamped, "max");

	assert.equal(typedAmountFactor(milk, Number.NaN), null, "an empty field changes nothing");
	assert.equal(typedAmountFactor(milk, 0), null);
	assert.equal(typedAmountFactor(salt, 5), null, "an item that does not scale cannot drive");

	assert.equal(clampedResult(50, 0.2).clamped, "min");
	assert.equal(clampedResult(50, 0.2).factor, MIN_FACTOR);
});

test("`?ref=` and `?result=` reproduce a state, and result wins", () => {
	const bases = { refAmount: 100, resultValue: 50 };

	assert.equal(factorFromSearch("?ref=250", bases)?.factor, 2.5);
	assert.equal(factorFromSearch("?result=25", bases)?.factor, 0.5);
	assert.equal(factorFromSearch("?ref=100&result=25", bases)?.factor, 0.5, "a link that says 25 soesjes means 25");
	assert.deepEqual(
		factorFromSearch("?ref=2,5", bases),
		{ factor: MIN_FACTOR, clamped: "min" },
		"a decimal comma is accepted, and a factor under the floor is clamped — and says so",
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
		// One row, attribute by attribute: order is a rendering detail, the
		// presence of each value is the contract.
		const row = html.match(/<li[^>]*data-ingredient="melk"[^>]*>/)?.[0] ?? "";
		for (const attribute of ['data-base="100"', 'data-unit="g"', 'data-scalable="1"']) {
			assert.ok(row.includes(attribute), `melk is missing ${attribute}`);
		}
		const saltRow = html.match(/<li[^>]*data-ingredient="zout"[^>]*>/)?.[0] ?? "";
		assert.ok(saltRow.includes('data-scalable="0"'), "salt is marked as fixed");
		assert.match(html, /data-result-input/);
		assert.doesNotMatch(html, /data-result-note/, "the sentence under the ingredients is gone");

		// The field itself is created by the script: without JavaScript there is
		// nothing that looks editable and does nothing.
		assert.doesNotMatch(html, /class="amount-input"/);
	});
});

test("a weighed ingredient that is bought by the piece says how many", () => {
	assert.equal(approxPieces(80, 17.5), 4.5);
	assert.equal(approxPieces(40, 17.5), 2.5, "halves, because half a yolk exists");
	assert.equal(approxPieces(35, 17.5), 2, "and it rounds to the nearest half, not up");
	assert.equal(approxPieces(160, 17.5), 9);
	assert.equal(approxPieces(1, 17.5), 0.5, "never nothing: you still need part of one");
	assert.equal(approxPieces(80, 0), 0, "no piece weight, no claim");

	assert.equal(approxText("Ongeveer %count% %name%.", "4,5", "eidooier"), "Ongeveer 4,5 eidooiers.");
	assert.equal(approxText("Ongeveer %count% %name%.", "1", "eidooier"), "Ongeveer 1 eidooier.");
	assert.equal(approxText("About %count% %name%.", "4.5", "egg yolk"), "About 4.5 egg yolks.");
});

test("one pod, two pods: the word follows the number", () => {
	assert.equal(unitFor(1, "stokje", "stokjes"), "stokje");
	assert.equal(unitFor(0.5, "stokje", "stokjes"), "stokje");
	assert.equal(unitFor(1.5, "stokje", "stokjes"), "stokje");
	assert.equal(unitFor(2, "stokje", "stokjes"), "stokjes");
	assert.equal(unitFor(3, "stokje", "stokjes"), "stokjes");
	assert.equal(unitFor(2, "g"), "g", "no plural given, no invention");
});

test("the static table and the yield say the same word as the list", async () => {
	await withServer(async ({ base }) => {
		const html = await (await fetch(`${base}/recepten/banketbakkersroom`)).text();
		// The 2× column of the table: "2 stokjes", not the database's "2 stuk".
		assert.match(html, /<td>2 stokjes<\/td>/);

		const buns = await (await fetch(`${base}/recepten/soesjes`)).text();
		assert.match(buns, /<span data-result-unit>\s*soesjes\s*<\/span>/);
	});
});

test("a pod that can be bought as extract counts in grams too", () => {
	assert.equal(substituteGrams(1, 8), 8);
	assert.equal(substituteGrams(1.5, 8), 12);
	assert.equal(substituteGrams(0.5, 8), 4);
	assert.equal(substituteGrams(3, 8), 24);
	assert.equal(substituteText("Of %amount% %name%.", "12 g", "vanille-extract"), "Of 12 g vanille-extract.");
});

test("the extract hint follows the number of pods, in both languages", async () => {
	await withServer(async ({ base }) => {
		const dutch = await (await fetch(`${base}/recepten/banketbakkersroom`)).text();
		assert.match(dutch, /data-grams-each="8" data-substitute-name="vanille-extract"/);
		assert.match(dutch, /Of 8 g vanille-extract\./);

		const english = await (await fetch(`${base}/en/recipes/banketbakkersroom`)).text();
		assert.match(english, /Or 8 g vanilla extract\./);
	});
});

test("the hint follows the weight, in both languages", async () => {
	await withServer(async ({ base }) => {
		const dutch = await (await fetch(`${base}/recepten/banketbakkersroom`)).text();
		assert.match(dutch, /data-each="17\.5" data-each-name="eidooier"/);
		assert.match(dutch, /Ongeveer 4,5 eidooiers\./);

		const english = await (await fetch(`${base}/en/recipes/banketbakkersroom`)).text();
		assert.match(english, /data-each-name="egg yolk"/);
		assert.match(english, />About 4.5 egg yolks\.</);
	});
});

test("the unit stays visible, in the word the recipe uses", async () => {
	await withServer(async ({ base }) => {
		const html = await (await fetch(`${base}/recepten/banketbakkersroom`)).text();
		// "1 stokje" in the data, not the database's "stuk".
		const vanilla = html.match(/<li[^>]*data-ingredient="vanille"[^>]*>/)?.[0] ?? "";
		for (const attribute of ['data-unit-display="stokje"', 'data-unit-plural="stokjes"', 'data-round="0.5"']) {
			assert.ok(vanilla.includes(attribute), `vanilla is missing ${attribute}`);
		}
	});
});

test("the field asks for an amount in grams and a count in soesjes", async () => {
	await withServer(async ({ base }) => {
		const custard = await (await fetch(`${base}/recepten/banketbakkersroom`)).text();
		assert.match(custard, /<span>Hoeveelheid<\/span>/, "600 g is an amount, not a count");

		const buns = await (await fetch(`${base}/recepten/soesjes`)).text();
		assert.match(buns, /<span>Aantal<\/span>/, "50 soesjes is a count");
	});
});

test("printing keeps the numbers and drops the fields", () => {
	const css = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");
	const print = css.slice(css.indexOf("@media print"));

	assert.match(
		print,
		/\.ingredients \.amount-input,\s*\.amount-unit \{\s*display: none !important;/,
		"a printed input is a blank line, and the unit travels inside the number",
	);
	assert.match(print, /\.ingredients li\.is-rescalable \.amount-text \{\s*display: inline;/);
	assert.match(print, /html\[data-rescaled="1"\] \.scale-section/, "a scaled list hides the static table");
});
