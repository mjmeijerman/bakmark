/**
 * The ½× / 1× / 2× table.
 *
 * Two things it must get right and one it must not: halve and double the
 * amounts, leave `scale: false` alone, and never show a false precision like
 * "0.5 vanilla pod".
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { SCALE_FACTORS, formatAmount, scaledIngredients } from "../src/lib/recipes.ts";
import { withServer } from "./helpers/server.mjs";

/** Only the fields these functions read. */
const ingredient = (overrides = {}) => ({
	id: "melk",
	name: "volle melk",
	amount: 300,
	unit: "g",
	...overrides,
});

test("half, one and double are the three factors, and nothing else", () => {
	assert.deepEqual([...SCALE_FACTORS], [0.5, 1, 2]);
});

test("an amount scales, a scale:false amount does not", () => {
	const [half, one, double_] = SCALE_FACTORS.map(
		(factor) => scaledIngredients([ingredient()], factor)[0].amount,
	);
	assert.deepEqual([half, one, double_], [150, 300, 600]);

	const salt = ingredient({ id: "zout", name: "zout", amount: 1.5, unit: "g", scale: false });
	assert.deepEqual(
		SCALE_FACTORS.map((factor) => scaledIngredients([salt], factor)[0].amount),
		[1.5, 1.5, 1.5],
		"a pinch is a pinch, however small the batch",
	);
});

test("amounts round to something a scale can show, in the reader's decimals", () => {
	const sugar = ingredient({ id: "suiker", amount: 5, unit: "g" });
	const [half] = scaledIngredients([sugar], 0.5);
	assert.equal(formatAmount(half), "2,5 g");
	assert.equal(formatAmount(scaledIngredients([sugar], 0.5, "en")[0]), "2.5 g");

	const salt = ingredient({ id: "zout", amount: 1.5, unit: "g" });
	assert.equal(formatAmount(scaledIngredients([salt], 0.5)[0]), "0,8 g", "no 0,75 g on a kitchen scale");
});

test("the page prints the table with three columns of the same ingredient", async () => {
	await withServer(async ({ base }) => {
		const html = await (await fetch(`${base}/recepten/soesjes`)).text();
		assert.match(html, /<table class="scale-table">/);
		for (const column of ["½×", "1×", "2×"]) {
			assert.ok(html.includes(`<th scope="col">${column}</th>`), `column ${column}`);
		}

		// Melk is 100 g in the base recipe: 50 / 100 / 200 in one row.
		assert.match(
			html,
			/<th scope="row">volle melk<\/th><td>50 g<\/td><td>100 g<\/td><td>200 g<\/td>/,
		);
		// Salt does not scale, so all three cells are the same.
		assert.match(
			html,
			/<th scope="row">zout<\/th><td>1,5 g<\/td><td>1,5 g<\/td><td>1,5 g<\/td>/,
		);
	});
});

test("the English page uses a dot and an English header", async () => {
	await withServer(async ({ base }) => {
		const html = await (await fetch(`${base}/en/recipes/soesjes`)).text();
		assert.ok(html.includes('<th scope="col">Ingredient</th>'));
		assert.match(
			html,
			/<th scope="row">sugar \(optional\)<\/th><td>2\.5 g<\/td><td>5 g<\/td><td>10 g<\/td>/,
		);
		assert.match(html, /<th scope="row">salt<\/th><td>1\.5 g<\/td><td>1\.5 g<\/td><td>1\.5 g<\/td>/, "no comma on the English page");
	});
});
