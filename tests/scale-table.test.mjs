/**
 * The ½× / 1× / 2× numbers behind the rescaler.
 *
 * Two things they must get right and one they must not: halve and double the
 * amounts, leave `scale: false` alone, and never show a false precision like
 * "0.5 vanilla pod". The page no longer prints a static table — the rescaler is
 * the only way to scale — but the arithmetic is the same.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { SCALE_FACTORS, formatAmount, scaledIngredients } from "../src/lib/recipes.ts";

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

