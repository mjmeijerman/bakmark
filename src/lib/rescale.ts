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
}

/** Below ten, one decimal; above, whole numbers. Grams of salt are not 0,333. */
export const round = (value: number): number =>
	value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;

/** The amount a `scale: false` item keeps, whatever the factor. */
export const scaledAmount = (base: RescaleBase, factor: number): number =>
	base.scalable ? round(base.amount * factor) : base.amount;

/**
 * The factor implied by typing an amount into one ingredient.
 *
 * Null means "ignore this keystroke": an empty field, a zero, a letter. A
 * rescaler that accepts those produces infinities and blanks while someone is
 * still typing.
 */
export const factorForAmount = (base: RescaleBase, value: number): number | null => {
	if (!base.scalable || base.amount <= 0) return null;
	if (!Number.isFinite(value) || value <= 0) return null;
	return clamp(value / base.amount);
};

/** The factor implied by asking for a different yield, e.g. 30 soesjes. */
export const factorForResult = (resultValue: number, target: number): number | null => {
	if (resultValue <= 0) return null;
	if (!Number.isFinite(target) || target <= 0) return null;
	return clamp(target / resultValue);
};

/** A batch factor nobody types on purpose; also what a stray keypress would give. */
export const MIN_FACTOR = 0.1;
export const MAX_FACTOR = 20;

const clamp = (factor: number): number => Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, factor));

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
): number | null => {
	const params = new URLSearchParams(search);
	const wanted = Number(params.get("result")?.replace(",", "."));
	if (Number.isFinite(wanted) && wanted > 0) return factorForResult(resultValue, wanted);

	const ref = Number(params.get("ref")?.replace(",", "."));
	if (Number.isFinite(ref) && ref > 0) {
		return factorForAmount({ amount: refAmount, unit: "", scalable: true }, ref);
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
