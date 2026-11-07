/**
 * The video description, with chapters, from the recipe JSON.
 *
 * Every step already carries `t`: where it starts in the recording. That is the
 * same timestamp the printed QR codes and the step photos use, so a video's
 * chapter list cannot drift from the page it belongs to.
 *
 * YouTube quietly ignores a chapter list that breaks its rules — a description
 * that looks right and a video with no chapters. The rules are therefore
 * checked here, and a published video with a broken list fails the test suite
 * instead of shipping.
 */
import { parseTimestamp } from "./frames.ts";
import type { Recipe } from "./recipes.ts";

export interface Chapter {
	seconds: number;
	title: string;
}

/** Below three chapters YouTube shows none. */
export const MIN_CHAPTERS = 3;
/** Every chapter has to last at least this long. */
export const MIN_CHAPTER_SECONDS = 10;
/**
 * A step marked `split` is broken up when it runs longer than this.
 *
 * Only hands-on phases are worth splitting: twenty minutes of kneading is a
 * stretch a baker wants to jump into, while thirty minutes of rising is one
 * chapter to skip past. The recipe says which is which; guessing from duration
 * alone would turn waiting into eight chapters that all say "deel 4/8".
 */
export const SPLIT_AFTER_SECONDS = 180;
/** Roughly how long one auto-made chapter runs; 20 min of kneading becomes five. */
export const SPLIT_TARGET_SECONDS = 240;

/** `0:00`, `9:30`, `1:02:03` — the three shapes YouTube accepts. */
export const formatTimestamp = (seconds: number): string => {
	const total = Math.max(0, Math.round(seconds));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const rest = total % 60;
	const pad = (value: number) => String(value).padStart(2, "0");
	return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
};

export interface PlanResult {
	chapters: Chapter[];
	/** Steps without a timestamp: nothing can be placed for them. */
	missing: string[];
}

/**
 * Where the chapters start and what they are called.
 *
 * A step may bring its own `chapters` array (absolute timestamps) when the
 * recording deserves real names — "kneden tot het deeg loslaat" beats "deel 3
 * van 5". Otherwise a step that is marked `split` is cut into even parts, and
 * everything else becomes exactly one chapter.
 */
export const chapterPlan = (recipe: Pick<Recipe, "slug" | "steps">): PlanResult => {
	const chapters: Chapter[] = [];
	const missing: string[] = [];

	for (const step of recipe.steps ?? []) {
		const start = step.chapters?.length
			? null
			: step.t === null
				? null
				: parseTimestamp(step.t);

		if (step.chapters?.length) {
			for (const chapter of step.chapters) {
				const seconds = parseTimestamp(chapter.t);
				if (seconds === null) {
					missing.push(`${step.id} (${chapter.t})`);
					continue;
				}
				chapters.push({ seconds, title: chapter.title });
			}
			continue;
		}

		if (start === null) {
			missing.push(step.id);
			continue;
		}

		const duration = step.duration ?? 0;
		const parts =
			step.split && duration >= SPLIT_AFTER_SECONDS
				? Math.max(2, Math.round(duration / SPLIT_TARGET_SECONDS))
				: 1;

		for (let part = 0; part < parts; part++) {
			chapters.push({
				seconds: start + Math.round((part * duration) / parts),
				title: part === 0 ? step.title : `${step.title} (deel ${part + 1}/${parts})`,
			});
		}
	}

	return {
		chapters: dedupe(chapters.sort((a, b) => a.seconds - b.seconds)),
		missing,
	};
};

/** Two chapters at the same second: YouTube keeps one, and silently drops the rest. */
const dedupe = (chapters: Chapter[]): Chapter[] =>
	chapters.filter((chapter, index) => index === 0 || chapter.seconds !== chapters[index - 1].seconds);

/** Everything YouTube would refuse, in the order it would refuse it. */
export const chapterProblems = ({ chapters, missing }: PlanResult): string[] => {
	const problems: string[] = [];

	if (missing.length > 0) {
		problems.push(`no timestamp for: ${missing.join(", ")}`);
	}
	if (chapters.length < MIN_CHAPTERS) {
		problems.push(
			`${chapters.length} chapter(s); YouTube needs at least ${MIN_CHAPTERS}`,
		);
	}
	if (chapters[0] && chapters[0].seconds !== 0) {
		problems.push(`the first chapter starts at ${formatTimestamp(chapters[0].seconds)}, not 0:00`);
	}
	chapters.forEach((chapter, index) => {
		const next = chapters[index + 1];
		if (!next) return;
		const length = next.seconds - chapter.seconds;
		if (length < MIN_CHAPTER_SECONDS) {
			problems.push(
				`"${chapter.title}" lasts ${length}s; every chapter needs ${MIN_CHAPTER_SECONDS}s`,
			);
		}
	});

	return problems;
};

/** The text that goes into YouTube, in Dutch: the videos are. */
export const videoDescription = ({
	recipe,
	siteUrl,
	chapterUrl,
}: {
	recipe: Pick<Recipe, "slug" | "title" | "subtitle" | "result" | "steps">;
	siteUrl: string;
	/** Where the recipe lives; defaults to its page on this site. */
	chapterUrl?: string;
}): string => {
	const { chapters } = chapterPlan(recipe);
	const base = siteUrl.replace(/\/+$/, "");
	const result = `${recipe.result.value} ${recipe.result.unit}`;

	// The recipe link goes above the chapter list: it is the one thing a viewer
	// is most likely to want, and in a search result only the first lines show.
	// YouTube only asks that the chapter list starts at 0:00, not that it is the
	// first thing in the description.
	return [
		`${recipe.title} — ${recipe.subtitle}`,
		`${result}, in één take gefilmd: geen knip, geen versnelling.`,
		"",
		`Recept met dezelfde stappen, de tijden en een printversie: ${chapterUrl ?? `${base}/recepten/${recipe.slug}`}`,
		"",
		"Hoofdstukken",
		...chapters.map((chapter) => `${formatTimestamp(chapter.seconds)} ${chapter.title}`),
		"",
		"Vragen? Zet ze hieronder; ik lees ze.",
	].join("\n");
};
