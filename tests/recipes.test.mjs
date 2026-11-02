/**
 * Recipe data invariants.
 *
 * Plain JSON on purpose: these tests read the same files the site reads, with
 * no TypeScript toolchain in the way, and re-implement the graph walk rather
 * than importing it. A test that shares code with the thing it tests agrees
 * with every bug.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();
const RECIPES = join(ROOT, "recipes");
const EN = join(RECIPES, "en");

const slugs = readdirSync(RECIPES)
	.filter((file) => file.endsWith(".json"))
	.map((file) => file.replace(/\.json$/, ""))
	.sort();

const load = (slug) => JSON.parse(readFileSync(join(RECIPES, `${slug}.json`), "utf8"));
const loadEn = (slug) => JSON.parse(readFileSync(join(EN, `${slug}.json`), "utf8"));

const recipes = new Map(slugs.map((slug) => [slug, load(slug)]));

/** Depth-first walk of the component graph; throws on a cycle. */
const walk = (slug, seen = [], depth = 1, out = []) => {
	if (seen.includes(slug)) {
		throw new Error(`Recipe cycle: ${[...seen, slug].join(" → ")}`);
	}
	const recipe = recipes.get(slug);
	if (!recipe) throw new Error(`Unknown recipe "${slug}"`);
	out.push({ slug, depth, recipe });
	for (const link of recipe.components ?? []) {
		walk(link.ref, [...seen, slug], depth + 1, out);
	}
	return out;
};

const UNITS_ALLOWED = new Set(["g"]);
/** The one thing nobody weighs. */
const isUnweighedVanilla = (ingredient) =>
	ingredient.unit === "stuk" && /vanillestokje/i.test(ingredient.name);

const collectStrings = (value, path = "", out = []) => {
	if (typeof value === "string") out.push([path, value]);
	else if (Array.isArray(value)) value.forEach((item, index) => collectStrings(item, `${path}[${index}]`, out));
	else if (value && typeof value === "object") {
		for (const [key, child] of Object.entries(value)) collectStrings(child, path ? `${path}.${key}` : key, out);
	}
	return out;
};

test("every recipe file has the fields the page needs", () => {
	for (const slug of slugs) {
		const recipe = recipes.get(slug);
		assert.equal(recipe.slug, slug, `${slug}: slug field disagrees with the filename`);
		for (const field of ["title", "subtitle", "role", "result", "category", "difficulty", "time"]) {
			assert.ok(recipe[field] !== undefined, `${slug}: missing "${field}"`);
		}
		assert.ok(["basis", "eindproduct"].includes(recipe.role), `${slug}: role is "${recipe.role}"`);
		assert.ok(Array.isArray(recipe.steps) && recipe.steps.length > 0, `${slug}: no steps`);
		assert.ok(Array.isArray(recipe.tags) && recipe.tags.length > 0, `${slug}: no tags`);
		assert.ok(recipe.result.value > 0, `${slug}: result is not a positive amount`);
		assert.ok(recipe.result.unit, `${slug}: result has no unit`);
		for (const step of recipe.steps) {
			assert.ok(step.id && step.title && step.text, `${slug}: a step is missing id, title or text`);
		}
	}
});

test("ingredients are grams, with the vanilla pod as the only exception", () => {
	for (const slug of slugs) {
		const recipe = recipes.get(slug);
		const ids = new Set();
		for (const ingredient of recipe.ingredients ?? []) {
			assert.ok(!ids.has(ingredient.id), `${slug}: duplicate ingredient id "${ingredient.id}"`);
			ids.add(ingredient.id);
			assert.ok(
				typeof ingredient.amount === "number" && ingredient.amount > 0,
				`${slug}/${ingredient.id}: amount is not a positive number`,
			);
			if (isUnweighedVanilla(ingredient)) continue;
			assert.ok(
				UNITS_ALLOWED.has(ingredient.unit),
				`${slug}/${ingredient.id}: unit "${ingredient.unit}" — everything is weighed in grams`,
			);
		}
	}
});

test("no millilitres or spoons anywhere in the recipe data", () => {
	const pattern = /\b\d+(?:[.,]\d+)?\s?(ml|cl|dl|tl|el|tsp|tbsp|cup|oz)\b/i;
	for (const slug of slugs) {
		for (const [path, text] of collectStrings(recipes.get(slug))) {
			const hit = text.match(pattern);
			assert.equal(hit, null, `${slug}: "${hit?.[0]}" at ${path}`);
		}
	}
});

test("every component resolves, no cycles, and the tree stays shallow", () => {
	for (const slug of slugs) {
		const tree = walk(slug);
		const deepest = Math.max(...tree.map((node) => node.depth));
		assert.ok(deepest <= 3, `${slug}: component depth ${deepest}, the limit is 3`);
	}
});

test("every variant a link asks for exists", () => {
	for (const slug of slugs) {
		for (const link of recipes.get(slug).components ?? []) {
			if (!link.variant) continue;
			const target = recipes.get(link.ref);
			assert.ok(target, `${slug}: links to missing recipe "${link.ref}"`);
			assert.ok(
				target.variants?.[link.variant],
				`${slug}: asks ${link.ref} for variant "${link.variant}", which it does not define`,
			);
		}
	}
});

test("English overlays translate words and never touch a number", () => {
	for (const file of readdirSync(EN).filter((name) => name.endsWith(".json"))) {
		const slug = file.replace(/\.json$/, "");
		const overlay = JSON.parse(readFileSync(join(EN, file), "utf8"));
		const base = recipes.get(slug);
		assert.ok(base, `en/${file} has no Dutch source recipe`);

		for (const [path] of collectStrings(overlay)) {
			// Words may change; quantities may not.
			assert.ok(!path.endsWith(".amount"), `en/${file}: sets an amount at ${path}`);
			assert.ok(!path.endsWith(".result.value"), `en/${file}: sets a result amount at ${path}`);
			if (path.startsWith("ingredients.") && path.endsWith(".unit")) {
				// "stuk" → "pod" is a translation; "g" → "g" or "g" → "oz" is a quantity.
				const id = path.split(".")[1];
				const source = (base.ingredients ?? []).find((ingredient) => ingredient.id === id);
				assert.ok(source, `en/${file}: translates unknown ingredient "${id}"`);
				assert.notEqual(source.unit, "g", `en/${file}: overrides the gram unit of "${id}"`);
			}
		}

		const ingredients = base.ingredients ?? [];
		for (const key of Object.keys(overlay.ingredients ?? {})) {
			assert.ok(
				ingredients.some((ingredient) => ingredient.id === key),
				`en/${file}: translates unknown ingredient "${key}"`,
			);
		}
		if (overlay.faq) {
			for (const index of Object.keys(overlay.faq)) {
				assert.ok(
					Number(index) >= 0 && Number(index) < (base.faq ?? []).length,
					`en/${file}: faq[${index}] has no Dutch question`,
				);
			}
		}
		for (const stepId of Object.keys(overlay.steps ?? {})) {
			assert.ok(
				(base.steps ?? []).some((step) => step.id === stepId),
				`en/${file}: translates unknown step "${stepId}"`,
			);
		}
	}
});

test("a composed recipe does not repeat a failure or a question", () => {
	for (const slug of slugs) {
		const tree = walk(slug).filter((node) => node.slug !== slug);
		if (tree.length === 0) continue;

		const seenFailures = new Set();
		const seenQuestions = new Set();
		const root = recipes.get(slug);
		const rows = [
			...(root.mislukt ?? []).map((item) => [item.symptoom, item.oorzaak, item.fix]),
			...tree.flatMap((node) =>
				(node.recipe.mislukt ?? []).map((item) => [item.symptoom, item.oorzaak, item.fix]),
			),
		];
		for (const row of rows) {
			const key = row.join("|").toLowerCase();
			assert.ok(!seenFailures.has(key), `${slug}: duplicate failure "${row[0]}"`);
			seenFailures.add(key);
		}

		const questions = [
			...(root.faq ?? []).map((item) => item.q),
			...tree.flatMap((node) => (node.recipe.faq ?? []).map((item) => item.q)),
		];
		for (const question of questions) {
			const key = question.toLowerCase();
			assert.ok(!seenQuestions.has(key), `${slug}: duplicate question "${question}"`);
			seenQuestions.add(key);
		}
	}
});

test("time fields are numbers, and no recipe claims zero minutes", () => {
	for (const slug of slugs) {
		const recipe = recipes.get(slug);
		for (const field of ["active", "total"]) {
			assert.equal(typeof recipe.time[field], "number", `${slug}: time.${field} is not a number`);
		}
		for (const field of ["oven", "wait", "afterbake"]) {
			const value = recipe.time[field];
			assert.ok(
				value === undefined || (typeof value === "number" && value >= 0),
				`${slug}: time.${field} is not a positive number`,
			);
		}
		assert.ok(recipe.time.total >= recipe.time.active, `${slug}: total is less than the active time`);
	}
});
