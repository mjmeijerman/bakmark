/**
 * Which videos are out, and which of those the last newsletter already covered.
 *
 * A recipe JSON is the only place a video exists: `video.status` says whether
 * it is out, `video.youtube_id` is where it plays. The weekly newsletter
 * compares the recipes production shipped against the ids it mailed last time,
 * so "new" means "published since the last mail", not "since the last deploy".
 *
 * Only data here. The mail itself lives in `newsletter.ts`, next to the
 * confirmation mail, so both use one set of links and one look.
 */
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { conceptsHidden } from "./recipes.ts";

export interface ReportVideo {
	slug: string;
	title: string;
	/** `concept`, `opgenomen` or `gepubliceerd`; only the last one is live. */
	status: string;
	/** Null until the recording is uploaded and published. */
	youtubeId: string | null;
	/** ISO date the recipe went live, when the file says so. */
	published: string | null;
}

/** Only the fields this module reads; the full recipe lives in recipes.ts. */
interface RecipeVideoFile {
	slug?: string;
	title?: string;
	published?: string;
	verified?: boolean;
	video?: { status?: string; youtube_id?: string | null };
}

const STATUS_PUBLISHED = "gepubliceerd";

/**
 * Every recipe with a video in this checkout, oldest first.
 *
 * `includeUnpublished` is for the hand-run preview (`--all`): it returns the
 * concepts too, so a test mail shows the layout before anything is live. The
 * weekly job never uses it, because reporting a video a viewer cannot watch is
 * noise.
 */
export const videosIn = (
	recipesDir: string,
	{ includeUnpublished = false } = {},
): ReportVideo[] => {
	const videos: ReportVideo[] = [];

	for (const name of readdirSync(recipesDir).sort()) {
		// recipes/en/ is a directory of text overlays, and never holds a video.
		if (!name.endsWith(".json")) continue;

		let recipe: RecipeVideoFile;
		try {
			recipe = JSON.parse(readFileSync(join(recipesDir, name), "utf8")) as RecipeVideoFile;
		} catch {
			continue;
		}

		const video = recipe.video;
		if (!video) continue;

		// A concept has no page on the public site, so mailing its link would mail
		// a 404. The preview keeps them: that is the point of a test mail.
		if (!includeUnpublished && conceptsHidden && recipe.verified === false) continue;

		const status = video.status ?? "concept";
		const youtubeId = video.youtube_id ?? null;

		// A youtube_id without "gepubliceerd" is a private upload: the id exists,
		// a viewer cannot watch it, so it is not a published video.
		if (!includeUnpublished && (status !== STATUS_PUBLISHED || !youtubeId)) continue;

		const slug = recipe.slug ?? name.slice(0, -".json".length);
		videos.push({
			slug,
			title: recipe.title ?? slug,
			status,
			youtubeId,
			published: recipe.published ?? null,
		});
	}

	return videos.sort(
		(a, b) =>
			(a.published ?? "").localeCompare(b.published ?? "") || a.title.localeCompare(b.title),
	);
};

/** What the last report mailed. Kept in the data directory, not in the checkout. */
export interface ReportState {
	/** When the last mail went out; empty means "never". */
	reported_at: string;
	youtube_ids: string[];
}

export const emptyState = (): ReportState => ({ reported_at: "", youtube_ids: [] });

export const readState = (file: string): ReportState => {
	try {
		const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<ReportState>;
		return {
			reported_at: typeof parsed.reported_at === "string" ? parsed.reported_at : "",
			youtube_ids: Array.isArray(parsed.youtube_ids)
				? parsed.youtube_ids.filter((id): id is string => typeof id === "string")
				: [],
		};
	} catch {
		// No file yet, or an unreadable one: everything published counts as new.
		// That is the safe direction; a corrupt snapshot must not silence the mail.
		return emptyState();
	}
};

export const writeState = (file: string, state: ReportState): void => {
	mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
	const temporary = `${file}.tmp`;
	writeFileSync(temporary, `${JSON.stringify(state, null, "\t")}\n`, { mode: 0o600 });
	// Rename, not write-in-place: a half-written snapshot would mark videos as
	// reported and the mail would never mention them.
	renameSync(temporary, file);
};

/** Ids already mailed, so a video that was reported once is not reported twice. */
export const newSince = (videos: ReportVideo[], state: ReportState): ReportVideo[] => {
	const reported = new Set(state.youtube_ids);
	return videos.filter((video) => video.youtubeId && !reported.has(video.youtubeId));
};

/** The snapshot to write after a mail: every id that is published now. */
export const snapshotOf = (videos: ReportVideo[], state: ReportState): ReportState => ({
	reported_at: state.reported_at,
	youtube_ids: videos
		.map((video) => video.youtubeId)
		.filter((id): id is string => typeof id === "string"),
});
