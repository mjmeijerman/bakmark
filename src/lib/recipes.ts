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
	scale?: boolean;
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

/** A link to another recipe, so one change lands everywhere it is used. */
export interface ComponentLink {
	ref: string;
	/** Scale relative to the component's own batch. */
	factor?: number;
	/** Or ask for a quantity in the component's result unit; factor is derived. */
	amount?: number;
	unit?: string;
	note?: string;
}

export interface Video {
	status: "concept" | "opgenomen" | "gepubliceerd";
	youtube_id: string | null;
}

export interface Recipe {
	slug: string;
	title: string;
	subtitle: string;
	role: "basis" | "gerecht";
	aliases?: string[];
	verified: boolean;
	verified_note?: string;
	video?: Video;
	result: { value: number; unit: string; note?: string };
	yield?: Record<string, unknown>;
	category: string;
	tags: string[];
	difficulty: number;
	time: { active: number; oven?: number; afterbake?: number; total: number; note?: string };
	context: string;
	ingredients: Ingredient[];
	components?: ComponentLink[];
	bake?: Record<string, any>;
	tin?: unknown;
	tools?: { name: string; required: boolean; note?: string }[];
	steps: Step[];
	faq?: { q: string; a: string }[];
	mislukt?: { symptoom: string; oorzaak: string; fix: string }[];
}

const cache = new Map<string, Recipe>();

export function loadRecipe(slug: string): Recipe {
	const cached = cache.get(slug);
	if (cached) return cached;
	const file = join(RECIPES_DIR, `${slug}.json`);
	let recipe: Recipe;
	try {
		recipe = JSON.parse(readFileSync(file, "utf8")) as Recipe;
	} catch {
		throw new Error(`Recipe "${slug}" not found in recipes/. A component link points nowhere.`);
	}
	cache.set(slug, recipe);
	return recipe;
}

export function allRecipes(): Recipe[] {
	return readdirSync(RECIPES_DIR)
		.filter((file) => file.endsWith(".json"))
		.map((file) => loadRecipe(file.replace(/\.json$/, "")))
		.sort((a, b) => a.title.localeCompare(b.title, "nl"));
}

/** Recipes plus the alias slugs they answer to. */
export function recipeRoutes(): { slug: string; recipe: Recipe; canonical: string }[] {
	return allRecipes().flatMap((recipe) => [
		{ slug: recipe.slug, recipe, canonical: recipe.slug },
		...(recipe.aliases ?? []).map((alias) => ({ slug: alias, recipe, canonical: recipe.slug })),
	]);
}

const factorFor = (component: Recipe, link: ComponentLink): number => {
	if (typeof link.factor === "number") return link.factor;
	if (typeof link.amount === "number") {
		if (link.unit && component.result.unit && link.unit !== component.result.unit) {
			throw new Error(
				`Component link "${link.ref}" asks for ${link.amount} ${link.unit}, but that recipe yields ${component.result.unit}.`,
			);
		}
		return link.amount / component.result.value;
	}
	return 1;
};

export interface ResolvedIngredient extends Ingredient {
	amount: number;
	amount_display: string;
	scaled: boolean;
}

export interface ResolvedGroup {
	recipe: Recipe;
	/** Cumulative factor: this component's links multiplied all the way down. */
	factor: number;
	link?: ComponentLink;
	ingredients: ResolvedIngredient[];
	steps: Step[];
	depth: number;
	/** True for a component that is only pulled in by another recipe. */
	nested: boolean;
}

export interface ResolvedRecipe {
	root: Recipe;
	groups: ResolvedGroup[];
}

const round = (value: number) =>
	value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;

export const formatAmount = (i: { amount: number; unit: string; amount_display?: string }) =>
	i.amount_display ?? `${String(i.amount).replace(".", ",")} ${i.unit}`;

const scaleIngredient = (ingredient: Ingredient, factor: number): ResolvedIngredient => {
	const scalable = ingredient.scale !== false;
	const amount = scalable ? round(ingredient.amount * factor) : ingredient.amount;
	const display =
		scalable && factor !== 1
			? `${String(amount).replace(".", ",")} ${ingredient.unit}`
			: (ingredient.amount_display ?? `${String(amount).replace(".", ",")} ${ingredient.unit}`);
	return { ...ingredient, amount, amount_display: display, scaled: scalable && factor !== 1 };
};

/**
 * Walk the component tree depth-first and flatten it into ordered groups:
 * every component's own steps come before the steps that assemble them.
 * Cycles throw at build time instead of hanging.
 */
export function resolveRecipe(root: Recipe): ResolvedRecipe {
	const groups: ResolvedGroup[] = [];
	const visiting: string[] = [];

	const walk = (recipe: Recipe, factor: number, depth: number, link?: ComponentLink, nested = false) => {
		if (visiting.includes(recipe.slug)) {
			throw new Error(`Recipe cycle: ${[...visiting, recipe.slug].join(" → ")}`);
		}
		visiting.push(recipe.slug);

		for (const child of recipe.components ?? []) {
			const component = loadRecipe(child.ref);
			walk(component, factor * factorFor(component, child), depth + 1, child, true);
		}

		groups.push({
			recipe,
			factor,
			link,
			ingredients: recipe.ingredients.map((ingredient) => scaleIngredient(ingredient, factor)),
			steps: recipe.steps,
			depth,
			nested,
		});

		visiting.pop();
	};

	walk(root, 1, 0);
	return { root, groups };
}

export const formatMinutes = (seconds: number) => {
	const min = Math.round(seconds / 60);
	if (min < 60) return `${min} min`;
	const rest = min % 60;
	return rest === 0 ? `${Math.floor(min / 60)} uur` : `${Math.floor(min / 60)} u ${rest} min`;
};

/** Chips as used by RecipeCard and the recipe hero. */
export const recipeChips = (r: Recipe) => [
	formatMinutes(r.time.total),
	`${r.result.value} ${r.result.unit}`,
	r.category,
	...(r.role === "basis" ? ["basisrecept"] : []),
];

/** Total time of the whole tree, so a composite does not under-promise. */
export const totalTime = (resolved: ResolvedRecipe) =>
	resolved.groups.reduce((sum, group) => sum + group.recipe.time.active, 0);
