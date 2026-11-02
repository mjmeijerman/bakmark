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
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { APIRoute } from "astro";

export const prerender = false;

const DB_PATH =
	process.env.SUBSCRIBERS_DB ?? join(process.cwd(), "data", "subscribers.sqlite");

let db: DatabaseSync | undefined;

const openDb = (): DatabaseSync => {
	if (db) return db;
	mkdirSync(dirname(DB_PATH), { recursive: true });
	db = new DatabaseSync(DB_PATH);
	db.exec(`
		CREATE TABLE IF NOT EXISTS subscribers (
			email TEXT PRIMARY KEY,
			lang TEXT NOT NULL,
			source TEXT,
			created_at TEXT NOT NULL,
			confirmed_at TEXT
		);
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

	const answer = (status: number, ok: boolean, error?: string, duplicate?: boolean) => {
		if (json) {
			return new Response(JSON.stringify({ ok, error, duplicate }), {
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
	if (isBot(request, body, ip)) return answer(201, true, undefined, false);

	try {
		const inserted = store(email, lang, source);
		return answer(inserted ? 201 : 200, true, undefined, !inserted);
	} catch (error) {
		console.error("[subscribe] could not store address", error);
		return answer(500, false, "server_error");
	}
};
