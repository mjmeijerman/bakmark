/**
 * Newsletter signup: store the address.
 *
 * The list lives on our own server, in a SQLite file next to the app
 * (`data/subscribers.sqlite`, override with SUBSCRIBERS_DB). No external
 * service sees the address; sending stays on the VPS too.
 *
 * Double opt-in is not wired yet: `confirmed_at` stays NULL until the
 * confirmation mail exists. Nothing sends from this endpoint today.
 */
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { APIRoute } from "astro";

export const prerender = false;

const DB_PATH =
	process.env.SUBSCRIBERS_DB ?? join(process.cwd(), "data", "subscribers.sqlite");

let db: DatabaseSync | undefined;

const openDb = (): DatabaseSync => {
	if (db) return db;
	mkdirSync(dirname(DB_PATH), { recursive: true, mode: 0o700 });
	db = new DatabaseSync(DB_PATH);

	// The list is nobody else's business: 0600 on the file, 0700 on the folder.
	try {
		chmodSync(DB_PATH, 0o600);
	} catch {
		/* a read-only file system fails later and louder */
	}

	db.exec(`
		PRAGMA journal_mode = WAL;
		PRAGMA synchronous = NORMAL;
		CREATE TABLE IF NOT EXISTS subscribers (
			email TEXT PRIMARY KEY,
			lang TEXT NOT NULL,
			source TEXT,
			created_at TEXT NOT NULL,
			confirmed_at TEXT
		);
		CREATE INDEX IF NOT EXISTS subscribers_created_at ON subscribers (created_at);
	`);
	return db;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const normalise = (value: unknown): string =>
	typeof value === "string" ? value.trim().toLowerCase() : "";

const isEmail = (value: string): boolean => value.length <= 254 && EMAIL.test(value);

const isLang = (value: unknown): "nl" | "en" => (value === "en" ? "en" : "nl");

/** One insert; a stale handle (file moved or deleted) is reopened once. */
const store = (email: string, lang: string, source: string | null): boolean => {
	const insert = () =>
		openDb()
			.prepare(
				`INSERT OR IGNORE INTO subscribers (email, lang, source, created_at)
				 VALUES (?, ?, ?, ?)`,
			)
			.run(email, lang, source, new Date().toISOString());

	try {
		return insert().changes > 0;
	} catch {
		db = undefined;
		return insert().changes > 0;
	}
};

/*
 * Bots. A public form fills up with junk, and a CAPTCHA means a third party
 * in the path, a privacy statement line and an accessibility problem.
 * Four cheap checks instead: a honeypot a human never sees, a minimum fill
 * time, a same-origin check, and a per-IP rate limit held in memory.
 * Every tripped check answers exactly like a success, so a bot learns nothing.
 */
const HONEYPOT_FIELD = "bedrijf";
const MIN_FILL_MS = 1500;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;

/** A distributed flood rotates IPs, so the day gets its own ceiling. */
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_MAX = 200;

const storedInLastDay = (): number => {
	const since = new Date(Date.now() - DAY_MS).toISOString();
	const row = openDb()
		.prepare("SELECT COUNT(*) AS n FROM subscribers WHERE created_at >= ?")
		.get(since) as { n: number } | undefined;
	return row?.n ?? 0;
};

const attempts = new Map<string, number[]>();

const overLimit = (ip: string): boolean => {
	const now = Date.now();
	const recent = (attempts.get(ip) ?? []).filter((at) => now - at < RATE_WINDOW_MS);
	recent.push(now);
	attempts.set(ip, recent);

	// Keep the map from growing forever on a long-lived process.
	if (attempts.size > 10_000) {
		for (const [key, times] of attempts) {
			if (times.every((at) => now - at >= RATE_WINDOW_MS)) attempts.delete(key);
		}
	}

	return recent.length > RATE_MAX;
};

const isBot = (request: Request, body: Payload, ip: string): boolean => {
	// Counted first, so a flood cannot dodge the limit by failing an earlier check.
	if (overLimit(ip)) return true;

	if (normalise(body[HONEYPOT_FIELD]) !== "") return true;

	try {
		if (storedInLastDay() >= DAY_MAX) return true;
	} catch {
		/* a broken count must not take the form down with it */
	}

	// The script sends its own fill time; a missing value is a plain form post, not a bot.
	const elapsed = Number(body.elapsed);
	if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < MIN_FILL_MS) return true;

	const origin = request.headers.get("origin");
	if (origin && origin !== new URL(request.url).origin) return true;

	return false;
};

type Payload = { email?: unknown; lang?: unknown; source?: unknown; elapsed?: unknown; [key: string]: unknown };

const readPayload = async (request: Request): Promise<{ body: Payload; json: boolean }> => {
	const type = request.headers.get("content-type") ?? "";
	if (type.includes("application/json")) {
		const body = (await request.json().catch(() => ({}))) as Payload;
		return { body, json: true };
	}
	const form = await request.formData().catch(() => new FormData());
	return { body: Object.fromEntries(form), json: false };
};

/** Only bounce back to our own origin, never to whatever the Referer claims. */
const backTo = (request: Request, outcome: "ok" | "fout"): string => {
	const fallback = new URL("/", request.url);
	const referer = request.headers.get("referer");
	let target = fallback;
	if (referer) {
		const url = new URL(referer);
		if (url.origin === new URL(request.url).origin) target = url;
	}
	target.searchParams.set("nieuwsbrief", outcome);
	target.hash = "nieuwsbrief";
	return target.toString();
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
	const { body, json } = await readPayload(request);
	const email = normalise(body.email);
	const lang = isLang(body.lang);
	const source = typeof body.source === "string" ? body.source.slice(0, 200) : null;

	const answer = (status: number, ok: boolean, error?: string) => {
		if (json) {
			return new Response(JSON.stringify({ ok, error }), {
				status,
				headers: { "content-type": "application/json" },
			});
		}
		return new Response(null, {
			status: 303,
			headers: { location: backTo(request, ok ? "ok" : "fout") },
		});
	};

	if (!isEmail(email)) return answer(400, false, "invalid_email");

	const ip =
		clientAddress ||
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
		"unknown";

	// Say "saved" and save nothing: a bot gets no signal to retune against.
	if (isBot(request, body, ip)) return answer(201, true);

	try {
		// Same answer whether it was new or already there: "are you on this
		// list?" is not a question a stranger gets to ask.
		store(email, lang, source);
		return answer(201, true);
	} catch (error) {
		console.error("[subscribe] could not store address", error);
		return answer(500, false, "server_error");
	}
};
