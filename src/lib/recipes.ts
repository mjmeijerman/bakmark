import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseTimestamp } from "./frames.ts";
import { DEFAULT_LANG, type Lang } from "./i18n.ts";

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
	/**
	 * What this scales in, when whole units are not the only option: a vanilla
	 * pod halves, salt does not. The step is also the floor — nobody wants 0,1
	 * of a pod, so half is the least you get.
	 */
	round?: number;
	/** The plural of the display unit: "2 stokjes", not "2 stokje". */
	unit_plural?: string;
	/**
	 * What one piece weighs, for an ingredient that is weighed but bought by the
	 * piece: 80 g of yolk is "about 4,5 egg yolks", and the number has to follow
	 * the batch.
	 */
	each?: { name: string; grams: number };
	/**
	 * For an ingredient bought by the piece and replaced by weight: one vanilla
	 * pod is 8 g of extract, so three pods are 24 g.
	 */
	substitute?: { name: string; grams_each: number };
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
	/**
	 * Hand-written chapters for this step, with absolute timestamps. Use it when
	 * the recording deserves real names; otherwise `split` cuts a long step into
	 * even parts (see chapters.ts).
	 */
	chapters?: { t: string; title: string }[];
	/** True for a hands-on phase long enough that a viewer wants to jump into it. */
	split?: boolean;
}

/** A link to another recipe, so one change lands everywhere it is used. */
export interface ComponentLink {
	ref: string;
	/** Scale relative to the component's own batch. */
	factor?: number;
	/** Or ask for a quantity in the component's result unit; factor is derived. */
	amount?: number;
	unit?: string;
	/** Named preset of the component, for a different composition with the same steps. */
	variant?: string;
	note?: string;
}

export interface Variant {
	label: string;
	note?: string;
	/** Ingredient id → amount. Omitted ids keep the base amount; 0 drops the ingredient. */
	ingredients?: Record<string, number>;
}

export interface Video {
	status: "concept" | "opgenomen" | "gepubliceerd";
	youtube_id: string | null;
	/** Chapter offset in seconds, for a part that starts mid-video. */
	start?: number;
}

/**
 * Where a reader who scanned a printed sheet ends up: the video itself.
 *
 * A published video is the only thing worth a code; `start` is what makes a
 * QR for one base recipe jump to that part's chapter instead of the opening
 * frame of a longer recording.
 */
export const videoWatchUrl = (video: Pick<Video, "youtube_id" | "start">): string => {
	const id = encodeURIComponent(video.youtube_id ?? "");
	return `https://www.youtube.com/watch?v=${id}${video.start ? `&t=${video.start}s` : ""}`;
};

/**
 * Seconds into the recording where one step starts.
 *
 * `start` covers a base recipe that lives inside a longer recording: its own
 * steps are timed from zero, the QR code and the step links are not.
 */
export const videoMoment = (
	video: Pick<Video, "start"> | undefined,
	step: string | null | undefined,
): number | null => {
	if (!step) return null;
	const seconds = parseTimestamp(step);
	if (seconds === null) return null;
	return (video?.start ?? 0) + seconds;
};

/** The same place, as a link for a reader who is not looking at the embed. */
export const videoMomentUrl = (
	video: Pick<Video, "youtube_id" | "start">,
	step: string | null | undefined,
): string | null => {
	const seconds = videoMoment(video, step);
	if (seconds === null) return null;
	const id = encodeURIComponent(video.youtube_id ?? "");
	return `https://www.youtube.com/watch?v=${id}&t=${seconds}s`;
};

/** The anchor the tip block carries, so a printed sheet can point at it. */
export const TIP_ANCHOR = "een-fooi";

export interface Recipe {
	slug: string;
	title: string;
	subtitle: string;
	role: "basis" | "eindproduct";
	aliases?: string[];
	verified: boolean;
	verified_note?: string;
	video?: Video;
	/** ISO date the recipe went live. Default sort order is newest first. */
	published?: string;
	result: {
		value: number;
		unit: string;
		/** For a yield of one: "1 soesje" from a unit of "soesjes". */
		unit_singular?: string;
		note?: string;
	};
	yield?: Record<string, unknown>;
	category: string;
	tags: string[];
	difficulty: number;
	time: {
		active: number;
		oven?: number;
		afterbake?: number;
		/** Cooling, resting, chilling. */
		wait?: number;
		total: number;
		note?: string;
	};
	context: string;
	ingredients: Ingredient[];
	/** Same steps, different composition: the milk/water split, for instance. */
	variants?: Record<string, Variant>;
	components?: ComponentLink[];
	bake?: Record<string, any>;
	tin?: unknown;
	tools?: { name: string; required: boolean; note?: string }[];
	steps: Step[];
	faq?: { q: string; a: string }[];
	mislukt?: { symptoom: string; oorzaak: string; fix: string }[];
}

const cache = new Map<string, Recipe>();

/** Things that belong under "benodigdheden", not in a shopping list. */
const TOOL_WORDS = ["papier", "bakplaat", "spuitzak", "garde", "spatel", "pan ", "folie", "weegschaal"];

const assertIngredientsAreFood = (recipe: Recipe) => {
	for (const ingredient of recipe.ingredients ?? []) {
		const name = ingredient.name.toLowerCase();
		const tool = TOOL_WORDS.find((word) => name.includes(word));
		if (tool) {
			throw new Error(
				`Recipe "${recipe.slug}" lists "${ingredient.name}" as an ingredient, but it is a tool. Move it to tools[].`,
			);
		}
	}
};

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
	assertIngredientsAreFood(recipe);
	cache.set(slug, recipe);
	return recipe;
}

/**
 * English text lives in recipes/en/<slug>.json as an overlay: only the words,
 * never the numbers. The Dutch file stays the single source of truth, so the
 * component graph and every factor keep working in one language.
 */
export interface RecipeTextOverlay {
	title?: string;
	subtitle?: string;
	context?: string;
	verified_note?: string;
	tags?: string[];
	result?: { unit?: string; note?: string };
	time?: { note?: string };
	ingredients?: Record<
		string,
		{
			name?: string;
			note?: string;
			unit?: string;
			amount_display?: string;
			each_name?: string;
			substitute_name?: string;
		}
	>;
	steps?: Record<string, { title?: string; text?: string; why?: string; tips?: string[] }>;
	tools?: Record<string, { name?: string; note?: string }>;
	components?: Record<string, { unit?: string; note?: string }>;
	faq?: Record<string, { q?: string; a?: string }>;
	mislukt?: Record<string, { symptoom?: string; oorzaak?: string; fix?: string }>;
	variants?: Record<string, { label?: string; note?: string }>;
	bake?: Record<string, string>;
}

const EN_OVERLAY_DIR = join(RECIPES_DIR, "en");
const overlayCache = new Map<string, RecipeTextOverlay | null>();

/* Cached for the build, read fresh in dev: a translation added while the dev
   server runs should show up on the next request, not after a restart. */
const cacheOverlays = import.meta.env?.PROD ?? true;

export function textOverlay(slug: string): RecipeTextOverlay | null {
	if (cacheOverlays) {
		const cached = overlayCache.get(slug);
		if (cached !== undefined) return cached;
	}
	let overlay: RecipeTextOverlay | null = null;
	try {
		overlay = JSON.parse(
			readFileSync(join(EN_OVERLAY_DIR, `${slug}.json`), "utf8"),
		) as RecipeTextOverlay;
	} catch {
		overlay = null;
	}
	if (cacheOverlays) overlayCache.set(slug, overlay);
	return overlay;
}

/** Display copy in `lang`; anything untranslated falls back to Dutch. */
export function localize(recipe: Recipe, lang: Lang = DEFAULT_LANG): Recipe {
	if (lang === DEFAULT_LANG) return recipe;
	const overlay = textOverlay(recipe.slug);
	if (!overlay) return recipe;

	return {
		...recipe,
		title: overlay.title ?? recipe.title,
		subtitle: overlay.subtitle ?? recipe.subtitle,
		context: overlay.context ?? recipe.context,
		verified_note: overlay.verified_note ?? recipe.verified_note,
		tags: overlay.tags ?? recipe.tags,
		result: {
			...recipe.result,
			unit: overlay.result?.unit ?? recipe.result.unit,
			note: overlay.result?.note ?? recipe.result.note,
		},
		time: { ...recipe.time, note: overlay.time?.note ?? recipe.time.note },
		ingredients: recipe.ingredients.map((ingredient) => ({
			...ingredient,
			name: overlay.ingredients?.[ingredient.id]?.name ?? ingredient.name,
			note: overlay.ingredients?.[ingredient.id]?.note ?? ingredient.note,
			// "about 4.5 egg yolks" / "ongeveer 4,5 eidooiers": the piece has a name too.
			each: ingredient.each
				? {
						...ingredient.each,
						name: overlay.ingredients?.[ingredient.id]?.each_name ?? ingredient.each.name,
					}
				: undefined,
			substitute: ingredient.substitute
				? {
						...ingredient.substitute,
						name:
							overlay.ingredients?.[ingredient.id]?.substitute_name ??
							ingredient.substitute.name,
					}
				: undefined,
			unit: overlay.ingredients?.[ingredient.id]?.unit ?? ingredient.unit,
			amount_display:
				overlay.ingredients?.[ingredient.id]?.amount_display ?? ingredient.amount_display,
		})),
		steps: recipe.steps.map((step) => ({
			...step,
			title: overlay.steps?.[step.id]?.title ?? step.title,
			text: overlay.steps?.[step.id]?.text ?? step.text,
			why: overlay.steps?.[step.id]?.why ?? step.why,
			tips: overlay.steps?.[step.id]?.tips ?? step.tips,
		})),
		tools: (recipe.tools ?? []).map((tool) => ({
			...tool,
			name: overlay.tools?.[tool.name]?.name ?? tool.name,
			note: overlay.tools?.[tool.name]?.note ?? tool.note,
		})),
		components: (recipe.components ?? []).map((link) => ({
			...link,
			unit: overlay.components?.[link.ref]?.unit ?? link.unit,
			note: overlay.components?.[link.ref]?.note ?? link.note,
		})),
		faq: (recipe.faq ?? []).map((item, index) => ({
			...item,
			q: overlay.faq?.[String(index)]?.q ?? item.q,
			a: overlay.faq?.[String(index)]?.a ?? item.a,
		})),
		mislukt: (recipe.mislukt ?? []).map((item, index) => ({
			...item,
			symptoom: overlay.mislukt?.[String(index)]?.symptoom ?? item.symptoom,
			oorzaak: overlay.mislukt?.[String(index)]?.oorzaak ?? item.oorzaak,
			fix: overlay.mislukt?.[String(index)]?.fix ?? item.fix,
		})),
		variants: recipe.variants
			? Object.fromEntries(
					Object.entries(recipe.variants).map(([key, variant]) => [
						key,
						{
							...variant,
							label: overlay.variants?.[key]?.label ?? variant.label,
							note: overlay.variants?.[key]?.note ?? variant.note,
						},
					]),
				)
			: recipe.variants,
		bake: recipe.bake
			? {
					...recipe.bake,
					...(Object.fromEntries(
						Object.entries(overlay.bake ?? {}).map(([key, value]) => [key, value]),
					) as Record<string, string>),
				}
			: recipe.bake,
	};
}

/** Same treatment for a resolved group: the amounts stay, the words change. */
export function localizeGroup(group: ResolvedGroup, lang: Lang = DEFAULT_LANG): ResolvedGroup {
	if (lang === DEFAULT_LANG) return group;
	const overlay = textOverlay(group.recipe.slug);
	const recipe = localize(group.recipe, lang);
	if (!overlay) return { ...group, recipe };
	return {
		...group,
		recipe,
		steps: recipe.steps,
		variantLabel: group.variant ? recipe.variants?.[group.variant]?.label : group.variantLabel,
		ingredients: group.ingredients.map((ingredient) => {
			const text = overlay.ingredients?.[ingredient.id];
			const unit = text?.unit ?? ingredient.unit;
			/* A scaled amount is rebuilt from unit + number, so a translated unit
			   has to be put back in rather than appended. */
			const amount_display =
				text?.amount_display ??
				(ingredient.scaled && text?.unit
					? `${String(ingredient.amount)} ${unit}`
					: ingredient.amount_display);
			return {
				...ingredient,
				name: text?.name ?? ingredient.name,
				note: text?.note ?? ingredient.note,
				// "about 4.5 egg yolks": the piece has a name of its own.
				each: ingredient.each
					? { ...ingredient.each, name: text?.each_name ?? ingredient.each.name }
					: undefined,
				substitute: ingredient.substitute
					? {
							...ingredient.substitute,
							name: text?.substitute_name ?? ingredient.substitute.name,
						}
					: undefined,
				unit,
				// Amounts are written the Dutch way in the recipe files ("1,5 g");
				// the English page says "1.5 g".
				amount_display: lang === "en" && amount_display
					? amount_display.replace(/(\d),(\d)/g, "$1.$2")
					: amount_display,
			};
		}),
	};
}

export function allRecipes(lang: Lang = DEFAULT_LANG): Recipe[] {
	return readdirSync(RECIPES_DIR)
		.filter((file) => file.endsWith(".json"))
		.map((file) => localize(loadRecipe(file.replace(/\.json$/, "")), lang))
		.sort((a, b) => a.title.localeCompare(b.title, lang === "en" ? "en" : "nl"));
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
	variant?: string;
	variantLabel?: string;
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

/**
 * The amount at a factor, rounded to what the ingredient is bought in.
 *
 * A vanilla pod halves: 0,5 is a real answer, 0,37 is not. The step doubles as
 * the floor, so a quarter batch still asks for half a pod rather than nothing.
 */
const scaleWithStep = (ingredient: Ingredient, factor: number): number => {
	const step = ingredient.round;
	if (!step || step <= 0) return round(ingredient.amount * factor);
	return Math.max(step, Math.round((ingredient.amount * factor) / step) * step);
};

export const formatAmount = (i: { amount: number; unit: string; amount_display?: string }) =>
	i.amount_display ?? `${String(i.amount).replace(".", ",")} ${i.unit}`;

/** Apply a named variant: override amounts by ingredient id, drop what goes to 0. */
const applyVariant = (recipe: Recipe, variant?: string): Ingredient[] => {
	if (!variant) return recipe.ingredients;
	const preset = recipe.variants?.[variant];
	if (!preset) {
		throw new Error(
			`Recipe "${recipe.slug}" has no variant "${variant}". Known: ${Object.keys(recipe.variants ?? {}).join(", ") || "none"}.`,
		);
	}
	return recipe.ingredients
		.map((ingredient) => {
			const override = preset.ingredients?.[ingredient.id];
			if (typeof override !== "number") return ingredient;
			const { amount_display: _dropped, ...rest } = ingredient;
			return { ...rest, amount: override };
		})
		.filter((ingredient) => ingredient.amount > 0);
};

/**
 * The word after a scaled number: "1 stokje", "2 stokjes".
 *
 * The unit column is display text ("stokje"), not the database unit ("stuk"), so
 * a scaled amount is rebuilt from the display word. Without this the table said
 * "2 stuk" while the list above it said "2 stokjes".
 */
const displayUnit = (ingredient: Ingredient, amount: number): string => {
	const singular = (ingredient.amount_display ?? "").replace(/^[\d.,]+\s*/, "") || ingredient.unit;
	return amount >= 2 && ingredient.unit_plural ? ingredient.unit_plural : singular;
};

const scaleIngredient = (ingredient: Ingredient, factor: number): ResolvedIngredient => {
	const scalable = ingredient.scale !== false;
	const amount = scalable ? scaleWithStep(ingredient, factor) : ingredient.amount;
	const number = String(amount).replace(".", ",");
	const display =
		scalable && factor !== 1
			? `${number} ${displayUnit(ingredient, amount)}`
			: (ingredient.amount_display ?? `${number} ${displayUnit(ingredient, amount)}`);
	return { ...ingredient, amount, amount_display: display, scaled: scalable && factor !== 1 };
};

/** The batches a static table offers: half, exactly one, double. */
export const SCALE_FACTORS = [0.5, 1, 2] as const;

/**
 * The same ingredients at another batch size.
 *
 * `scale: false` items (salt, a vanilla pod) keep their amount: half a batch
 * still needs the pod, and "0.5 pod" is not a thing. The resolved amounts are
 * the input here, so a component link's factor stays part of the sum.
 */
export const scaledIngredients = (
	ingredients: Ingredient[],
	factor: number,
	lang: Lang = DEFAULT_LANG,
): ResolvedIngredient[] =>
	ingredients.map((ingredient) => {
		const scaled = scaleIngredient(ingredient, factor);
		// A scaled amount is rebuilt from unit + number, so it does not come
		// through localize() and its dot-for-comma rule.
		return lang === "en"
			? { ...scaled, amount_display: scaled.amount_display.replace(/(\d),(\d)/g, "$1.$2") }
			: scaled;
	});

/**
 * Walk the component tree depth-first and flatten it into ordered groups:
 * every component's own steps come before the steps that assemble them.
 * Cycles throw at build time instead of hanging.
 */
export function resolveRecipe(root: Recipe): ResolvedRecipe {
	const groups: ResolvedGroup[] = [];
	const visiting: string[] = [];

	const walk = (
		recipe: Recipe,
		factor: number,
		depth: number,
		link?: ComponentLink,
		nested = false,
		variant?: string,
	) => {
		const variantLabel = variant ? recipe.variants?.[variant]?.label : undefined;
		if (visiting.includes(recipe.slug)) {
			throw new Error(`Recipe cycle: ${[...visiting, recipe.slug].join(" → ")}`);
		}
		visiting.push(recipe.slug);

		for (const child of recipe.components ?? []) {
			const component = loadRecipe(child.ref);
			walk(component, factor * factorFor(component, child), depth + 1, child, true, child.variant);
		}

		groups.push({
			recipe,
			factor,
			link,
			variant,
			variantLabel,
			ingredients: applyVariant(recipe, variant).map((ingredient) => scaleIngredient(ingredient, factor)),
			steps: recipe.steps,
			depth,
			nested,
		});

		visiting.pop();
	};

	walk(root, 1, 0);
	return { root, groups };
}

/** Fixed list (D20). One category per recipe; facets carry the rest. */
export const CATEGORIES = [
	{ id: "basistechniek", label: "basistechniek" },
	{ id: "deeg-beslag", label: "deeg & beslag" },
	{ id: "room-vulling", label: "room & vulling" },
	{ id: "gebak", label: "gebak" },
	{ id: "brood", label: "brood" },
	{ id: "chocolade", label: "chocolade" },
	{ id: "hartig", label: "hartig" },
] as const;

const CATEGORY_LABELS_EN: Record<string, string> = {
	basistechniek: "core technique",
	"deeg-beslag": "dough & batter",
	"room-vulling": "cream & filling",
	gebak: "pastry",
	brood: "bread",
	chocolade: "chocolate",
	hartig: "savoury",
};

export const categoryLabel = (id: string, lang: Lang = DEFAULT_LANG) =>
	lang === "en"
		? (CATEGORY_LABELS_EN[id] ?? id)
		: (CATEGORIES.find((category) => category.id === id)?.label ?? id);

export const DIFFICULTY_SCALE = 5;

/** Words beat a fraction: "gemiddeld" needs no translation, "3/5" does. */
export const DIFFICULTY_WORDS = [
	"makkelijk",
	"goed te doen",
	"gemiddeld",
	"lastig",
	"gevorderd",
] as const;

const DIFFICULTY_WORDS_EN = [
	"easy",
	"straightforward",
	"average",
	"tricky",
	"advanced",
] as const;

export const difficultyWord = (level: number, lang: Lang = DEFAULT_LANG) => {
	const words = lang === "en" ? DIFFICULTY_WORDS_EN : DIFFICULTY_WORDS;
	return words[Math.min(Math.max(Math.round(level), 1), DIFFICULTY_SCALE) - 1];
};

/** "gerecht" read as a savoury dinner; the finished bake is the "eindproduct". */
export const ROLE_LABELS: Record<Recipe["role"], string> = {
	basis: "basisrecept",
	eindproduct: "eindproduct",
};

const ROLE_LABELS_EN: Record<Recipe["role"], string> = {
	basis: "base recipe",
	eindproduct: "finished bake",
};

export const roleLabel = (role: Recipe["role"], lang: Lang = DEFAULT_LANG) => {
	const labels = lang === "en" ? ROLE_LABELS_EN : ROLE_LABELS;
	return labels[role] ?? role;
};

/** One lowercase blob per recipe: what a keyword search looks through. */
export function searchText(recipe: Recipe, lang: Lang = DEFAULT_LANG): string {
	return [
		recipe.title,
		recipe.subtitle,
		roleLabel(recipe.role, lang),
		categoryLabel(recipe.category, lang),
		...(recipe.tags ?? []),
		...(recipe.aliases ?? []),
		...recipe.ingredients.map((ingredient) => ingredient.name),
		...(recipe.components ?? []).map((link) => link.ref.replace(/-/g, " ")),
		...recipe.steps.flatMap((step) => [step.title, step.text]),
		...(recipe.faq ?? []).map((item) => item.q),
	]
		.join(" ")
		.toLowerCase();
}

export const TIME_BUCKETS = [
	{ id: "kort", label: "tot 30 min", min: 0, max: 1800 },
	{ id: "middel", label: "30-60 min", min: 1800, max: 3600 },
	{ id: "lang", label: "langer dan 1 uur", min: 3600, max: Number.POSITIVE_INFINITY },
] as const;

const TIME_BUCKET_LABELS_EN: Record<string, string> = {
	kort: "up to 30 min",
	middel: "30-60 min",
	lang: "longer than 1 hour",
};

export const timeBuckets = (lang: Lang = DEFAULT_LANG) =>
	TIME_BUCKETS.map((bucket) => ({
		...bucket,
		label: lang === "en" ? (TIME_BUCKET_LABELS_EN[bucket.id] ?? bucket.label) : bucket.label,
	}));

export const SORT_OPTIONS = [
	{ id: "nieuwste", label: "Nieuwste eerst" },
	{ id: "az", label: "Alfabetisch" },
	{ id: "moeilijkheid", label: "Makkelijk eerst" },
	{ id: "tijd", label: "Snelst klaar" },
] as const;

const SORT_LABELS_EN: Record<string, string> = {
	nieuwste: "Newest first",
	az: "Alphabetical",
	moeilijkheid: "Easiest first",
	tijd: "Quickest done",
};

export const sortOptions = (lang: Lang = DEFAULT_LANG) =>
	SORT_OPTIONS.map((option) => ({
		...option,
		label: lang === "en" ? (SORT_LABELS_EN[option.id] ?? option.label) : option.label,
	}));

export type SortId = (typeof SORT_OPTIONS)[number]["id"];

/** Sort key for a recipe; unknown dates sort last, never first. */
export const publishedValue = (recipe: Recipe) =>
	recipe.published ? Date.parse(recipe.published) : 0;

export const formatDate = (iso?: string, lang: Lang = DEFAULT_LANG) => {
	if (!iso) return "";
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "nl-NL", {
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(date);
};

export const formatMinutes = (seconds: number, lang: Lang = DEFAULT_LANG) => {
	const min = Math.round(seconds / 60);
	if (min < 60) return `${min} min`;
	const rest = min % 60;
	if (lang === "en") {
		return rest === 0
			? `${Math.floor(min / 60)} ${Math.floor(min / 60) === 1 ? "hour" : "hours"}`
			: `${Math.floor(min / 60)} h ${rest} min`;
	}
	return rest === 0 ? `${Math.floor(min / 60)} uur` : `${Math.floor(min / 60)} u ${rest} min`;
};

/** Chips as used by RecipeCard and the recipe hero. */
export interface RecipeTiming {
	active: number;
	oven: number;
	wait: number;
	total: number;
}

/**
 * The times of a recipe and of every part, each counted once.
 *
 * Totaal is the sum of the other three, on purpose: a page that shows parts
 * which do not add up to its total is a page nobody trusts. A hand-written
 * total on a composed recipe used to disagree with its own parts (the cooling
 * of one part overlapping the work on another), so the total is derived now.
 */
export function recipeTiming(slug: string): RecipeTiming {
	// Resolved from disk, not from a localised copy: the overlay translates
	// units, and a unit that no longer matches the part trips the graph check.
	const { groups } = resolveRecipe(loadRecipe(slug));
	const sum = (pick: (item: Recipe) => number) =>
		groups.reduce((total, group) => total + pick(group.recipe), 0);

	const active = sum((item) => item.time.active);
	const oven = sum((item) => item.time.oven ?? 0);
	const wait = sum((item) => item.time.wait || item.time.afterbake || 0);

	return { active, oven, wait, total: active + oven + wait };
}

export const recipeChips = (r: Recipe, lang: Lang = DEFAULT_LANG) => [
	formatMinutes(recipeTiming(r.slug).total, lang),
	`${r.result.value} ${r.result.unit}`,
	categoryLabel(r.category, lang),
	roleLabel(r.role, lang),
];

/**
 * Reverse lookup for the component graph: which recipes use this one, directly
 * and through another component. This is the navigation no recipe site has.
 */
export function usedIn(slug: string): { recipe: Recipe; via: string | null }[] {
	const all = allRecipes();
	const found: { recipe: Recipe; via: string | null }[] = [];
	const seen = new Set([slug]);
	let frontier = [slug];

	while (frontier.length) {
		const next: string[] = [];
		for (const current of frontier) {
			for (const candidate of all) {
				if (seen.has(candidate.slug)) continue;
				if (!(candidate.components ?? []).some((link) => link.ref === current)) continue;
				seen.add(candidate.slug);
				next.push(candidate.slug);
				found.push({
					recipe: candidate,
					via: current === slug ? null : current,
				});
			}
		}
		frontier = next;
	}

	return found;
}


