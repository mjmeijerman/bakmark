import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Single source of truth: recipes/<slug>.json (see docs/decisions/bakmark-plan.md D4). */
const RECIPES_DIR = join(process.cwd(), "recipes");

export interface Ingredient {
	id: string;
	name: string;
	amount: number;
	unit: string;
	amount_display?: string;
	note?: string;
	optional?: boolean;
}

export interface Step {
	id: string;
	title: string;
	duration: number;
	t: string | null;
	photo: string | null;
	text: string;
	why?: string;
	tips?: string[];
}

export interface Recipe {
	slug: string;
	title: string;
	subtitle: string;
	verified: boolean;
	verified_note?: string;
	result: { value: number; unit: string; note?: string };
	yield: Record<string, unknown>;
	category: string;
	tags: string[];
	difficulty: number;
	time: { active: number; oven?: number; afterbake?: number; total: number; note?: string };
	context: string;
	ingredients: Ingredient[];
	bake: Record<string, any>;
	tin: unknown;
	tools: { name: string; required: boolean; note?: string }[];
	steps: Step[];
	faq: { q: string; a: string }[];
	mislukt?: { symptoom: string; oorzaak: string; fix: string }[];
}

export function allRecipes(): Recipe[] {
	return readdirSync(RECIPES_DIR)
		.filter((file) => file.endsWith(".json"))
		.map((file) => JSON.parse(readFileSync(join(RECIPES_DIR, file), "utf8")) as Recipe)
		.sort((a, b) => a.title.localeCompare(b.title, "nl"));
}

export const formatMinutes = (seconds: number) => {
	const min = Math.round(seconds / 60);
	if (min < 60) return `${min} min`;
	const rest = min % 60;
	return rest === 0 ? `${Math.floor(min / 60)} uur` : `${Math.floor(min / 60)} u ${rest} min`;
};

export const formatAmount = (i: Ingredient) =>
	i.amount_display ?? `${String(i.amount).replace(".", ",")} ${i.unit}`;

/** Chips as used by RecipeCard and the recipe hero. */
export const recipeChips = (r: Recipe) => [
	formatMinutes(r.time.total),
	`${r.result.value} ${r.result.unit}`,
	r.category,
];
