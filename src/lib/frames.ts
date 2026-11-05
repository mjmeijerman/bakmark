/**
 * One photo per step, taken from the recording.
 *
 * A step carries `t`: where it starts in the video, written the way YouTube
 * chapters are written. That timestamp is the only input, so the photo and the
 * chapter can never disagree: one change moves both.
 */

export interface FrameStep {
	id: string;
	/** `m:ss`, `h:mm:ss`, or a bare number of seconds. Null until recorded. */
	t: string | null;
}

export interface Frame {
	stepId: string;
	seconds: number;
	/** Where the frame goes, relative to the output directory: `<slug>/<step>.jpg`. */
	file: string;
}

/**
 * `1:05` → 65, `1:02:03` → 3723, `65` → 65. Anything else is null.
 *
 * Deliberately strict about the shape and not about the length: a 90-minute
 * recording is one number with a colon in it, and refusing it because the plan
 * said "under 20 minutes" would fail a file, not a promise.
 */
export const parseTimestamp = (value: string): number | null => {
	const text = value.trim();
	if (!/^\d+(?::\d{1,2}){0,2}$/.test(text)) return null;

	const parts = text.split(":").map(Number);
	// A minute or second field of 60+ is a typo, not a long minute.
	if (parts.slice(1).some((part) => part > 59)) return null;

	return parts.reduce((total, part) => total * 60 + part, 0);
};

/**
 * What to pull, and what cannot be pulled.
 *
 * A step without a timestamp is not a failure of the recording, it is a gap in
 * the recipe file: the caller decides whether that is worth stopping for.
 */
export const framePlan = (
	recipe: { slug: string; steps: FrameStep[] },
	{ outDir = "public/fotos", ext = "jpg" }: { outDir?: string; ext?: string } = {},
): { frames: Frame[]; missing: string[] } => {
	const frames: Frame[] = [];
	const missing: string[] = [];

	for (const step of recipe.steps) {
		const seconds = step.t === null ? null : parseTimestamp(step.t);
		if (seconds === null) {
			missing.push(step.id);
			continue;
		}
		frames.push({
			stepId: step.id,
			seconds,
			file: `${recipe.slug}/${step.id}.${ext}`,
		});
	}

	return { frames, missing };
};

/** The ffmpeg arguments for one frame. Exported so a test can read them. */
export const frameArgs = ({
	video,
	seconds,
	output,
	width,
}: {
	video: string;
	seconds: number;
	output: string;
	width: number;
}): string[] => [
	"-hide_banner",
	"-loglevel",
	"error",
	// Before -i: ffmpeg seeks accurately by default, and on a long recording
	// this is the difference between a fraction of a second and a full decode.
	"-ss",
	String(seconds),
	"-i",
	video,
	"-frames:v",
	"1",
	// Never upscale: a 720p recording should not become a blurry 1200px photo.
	"-vf",
	`scale='min(${width},iw)':-2`,
	"-q:v",
	"3",
	"-y",
	output,
];
