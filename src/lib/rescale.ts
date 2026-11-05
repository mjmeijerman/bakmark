/**
 * The rescaler: one factor, applied to everything that may scale.
 *
 * The recipe page renders its amounts once, at 1×. This module is the arithmetic
 * behind the inputs that follow a change — and the same arithmetic the static
 * ½×/1×/2× table uses, so the two can never disagree.
 *
 * Two rules that are easy to get wrong and hard to notice:
 * `scale: false` items never move (half a batch still needs the vanilla pod),
 * and nothing shows a precision a kitchen scale cannot weigh.
 */
export interface RescaleBase {
	/** The amount at 1×, in the ingredient's own unit. */
	amount: number;
	unit: string;
	/** `scale: false` items keep their amount whatever the factor. */
	scalable: boolean;
	/**
	 * What this scales in, for things bought in halves: a vanilla pod is 0,5 or
	 * 1 or 1,5, never 0,37. The step is also the floor, so a quarter batch still
	 * asks for half a pod.
	 */
	step?: number;
}

/** Below ten, one decimal; above, whole numbers. Grams of salt are not 0,333. */
export const round = (value: number): number =>
	value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;

/** The amount a `scale: false` item keeps, whatever the factor. */
export const scaledAmount = (base: RescaleBase, factor: number): number => {
	if (!base.scalable) return base.amount;

	const step = base.step;
	if (!step || step <= 0) return round(base.amount * factor);

	// Rounded to the step, and never below one step: half a pod is a real
	// answer, a tenth of a pod is a shopping problem.
	return Math.max(step, Math.round((base.amount * factor) / step) * step);
};

/** Which bound a factor hit, if any: the UI has to be able to say so. */
export type Clamp = "min" | "max" | null;

export const clampFactor = (raw: number): { factor: number; clamped: Clamp } => {
	if (raw < MIN_FACTOR) return { factor: MIN_FACTOR, clamped: "min" };
	if (raw > MAX_FACTOR) return { factor: MAX_FACTOR, clamped: "max" };
	return { factor: raw, clamped: null };
};

/**
 * What a typed amount means, including the case where it was pushed to a bound.
 *
 * Null is "not a number I can use": an empty field, a zero, a letter. The answer
 * to that is to leave everything alone — not to fill the field with the smallest
 * batch, which is what made the first version unusable while typing.
 */
export const typedAmountFactor = (
	base: RescaleBase,
	typed: number,
): { factor: number; clamped: Clamp } | null => {
	if (!base.scalable || base.amount <= 0) return null;
	if (!Number.isFinite(typed) || typed <= 0) return null;
	return clampFactor(typed / base.amount);
};

/**
 * The factor implied by typing an amount into one ingredient.
 *
 * Null means "ignore this input": an empty field, a zero, a letter.
 */
export const factorForAmount = (base: RescaleBase, value: number): number | null =>
	typedAmountFactor(base, value)?.factor ?? null;

/** The factor implied by asking for a different yield, e.g. 30 soesjes. */
export const factorForResult = (resultValue: number, target: number): number | null => {
	if (resultValue <= 0) return null;
	if (!Number.isFinite(target) || target <= 0) return null;
	return clampFactor(target / resultValue).factor;
};

/** A batch factor nobody types on purpose; also what a stray keypress would give. */
export const MIN_FACTOR = 0.1;
export const MAX_FACTOR = 20;

/** The same bound, for a yield: `rescale` in the UI reports it the same way. */
export const clampedResult = (resultValue: number, target: number) =>
	clampFactor(target / resultValue);

/**
 * How many pieces a weighed amount comes down to: 80 g of yolk at 17,5 g each is
 * 4,5 egg yolks. Halves, because half a yolk exists; a tenth does not.
 */
export const approxPieces = (amount: number, gramsEach: number): number => {
	if (!(gramsEach > 0) || !Number.isFinite(amount)) return 0;
	const pieces = amount / gramsEach;
	return Math.max(0.5, Math.round(pieces * 2) / 2);
};

/**
 * "Of 24 g vanille-extract." for an ingredient bought by the piece and replaced
 * by weight: three pods at 8 g each.
 */
export const substituteGrams = (pieces: number, gramsEach: number): number =>
	Math.round(pieces * gramsEach * 10) / 10;

/** "Of 24 g vanille-extract." from a template with %amount% and %name%. */
export const substituteText = (template: string, amount: string, name: string): string =>
	template.replace("%amount%", amount).replace("%name%", name);

/**
 * The word after a number: "1 stokje", "2 stokjes", "0,5 stokje".
 *
 * Dutch uses the singular up to and including one; from two it is plural. A
 * count with no plural given falls back to the singular, which is wrong less
 * often than adding an "s" to a word that does not take one.
 */
export const unitFor = (amount: number, singular: string, plural?: string): string =>
	amount >= 2 && plural ? plural : singular;

/**
 * "Ongeveer 4,5 eidooiers." from a template with %count% and %name%.
 *
 * Shared by the server render and the script, so the hint reads the same before
 * and after a change. The plural follows the number: one yolk, two yolks.
 */
export const approxText = (template: string, count: string, name: string): string =>
	template.replace("%count%", count).replace("%name%", count === "1" ? name : `${name}s`);

/** `1,5` in Dutch, `1.5` in English; no trailing `,0`. */
export const formatAmount = (value: number, lang: "nl" | "en"): string => {
	const text = String(round(value));
	return lang === "en" ? text : text.replace(".", ",");
};

/**
 * The factor a shared URL asks for: `?ref=500` is 500 of the reference
 * ingredient, `?result=30` is a yield of 30.
 *
 * `result` wins when both are present: a link that says "30 soesjes" means that,
 * whatever else was in the address bar when it was copied.
 */
export const factorFromSearch = (
	search: string,
	{ refAmount, resultValue }: { refAmount: number; resultValue: number },
): { factor: number; clamped: Clamp } | null => {
	const params = new URLSearchParams(search);

	const wanted = Number(params.get("result")?.replace(",", "."));
	if (Number.isFinite(wanted) && wanted > 0) return clampedResult(resultValue, wanted);

	const ref = Number(params.get("ref")?.replace(",", "."));
	if (Number.isFinite(ref) && ref > 0) {
		return typedAmountFactor({ amount: refAmount, unit: "", scalable: true }, ref);
	}

	return null;
};

/** The query a state is shared as; `?ref=` for the reference ingredient. */
export const searchFor = (
	state: { factor: number; drivenBy: "ref" | "result"; resultValue: number },
	refAmount: number,
): string => {
	if (state.drivenBy === "result") return `?result=${round(state.resultValue * state.factor)}`;
	return `?ref=${round(refAmount * state.factor)}`;
};
