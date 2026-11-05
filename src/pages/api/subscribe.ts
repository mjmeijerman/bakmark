/**
 * Newsletter signup: store the address, then ask the owner to confirm it.
 *
 * The list lives on our own server, in a SQLite file next to the app
 * (`data/subscribers.sqlite`, override with SUBSCRIBERS_DB). No external
 * service sees the address; sending stays on the VPS too.
 *
 * A signup is not a subscription. The row starts with `confirmed_at` NULL, and
 * the only mail an unconfirmed address ever gets is the confirmation request.
 * In development that mail goes to the catcher and never to the internet; see
 * `src/lib/mail.ts`.
 */
import type { APIRoute } from "astro";
import { isAllowed } from "../../lib/allowlist";
import { newToken, sendConfirmation } from "../../lib/newsletter";
import {
	deleteByConfirmToken,
	store,
	storedSince,
} from "../../lib/list";

export const prerender = false;

const normalise = (value: unknown): string =>
	typeof value === "string" ? value.trim().toLowerCase() : "";

/*
 * One @, a sensible local part, real DNS labels, an alphabetic TLD.
 * Deliberately strict: "a@b..com", "a.@b.com" and "a@-b.com" are not
 * addresses, and a list full of them is worse than a rejected signup.
 * IDN addresses are not accepted; nobody needs one to hear about recipes.
 */
const LOCAL = /^[a-z0-9!#$%&'*+/=?^`{|}~.-]+$/i;
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const TLD = /^[a-z]{2,63}$/i;

const isEmail = (value: string): boolean => {
	if (value.length < 6 || value.length > 254) return false;

	const at = value.lastIndexOf("@");
	if (at < 1 || at !== value.indexOf("@")) return false;

	const local = value.slice(0, at);
	const domain = value.slice(at + 1);

	if (local.length > 64) return false;
	if (!LOCAL.test(local)) return false;
	if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;

	const labels = domain.split(".");
	if (labels.length < 2) return false;
	if (!labels.every((label) => LABEL.test(label))) return false;

	return TLD.test(labels.at(-1) ?? "");
};

const isLang = (value: unknown): "nl" | "en" => (value === "en" ? "en" : "nl");

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

const storedInLastDay = (): number =>
	storedSince(new Date(Date.now() - DAY_MS).toISOString());

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

	// The request's own URL can hide the public origin: behind the container's
	// 8085-to-4321 mapping (or the nginx vhost on the VPS) request.url is the internal
	// host, so a perfectly legitimate same-origin request would read as
	// cross-origin. Compare against the Host the browser put in the URL bar.
	const origin = request.headers.get("origin");
	if (origin) {
		let originHost;
		try {
			originHost = new URL(origin).host.toLowerCase();
		} catch {
			return true;
		}
		const host = request.headers
			.get("host")
			?.toLowerCase();
		if (!host || originHost !== host) return true;
	}

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

/**
 * Public origin as the browser sees it. request.url is the internal host
 * behind the port mapping or nginx, so derive the address from the Host
 * header instead; fall back to the request when Host is absent.
 */
const publicOrigin = (request: Request): string => {
	const host = request.headers.get("host");
	if (host) {
		const secure = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https";
		return `${secure ? "https" : "http"}://${host}`;
	}
	return new URL(request.url).origin;
};

/** Only bounce back to our own origin, never to whatever the Referer claims. */
const backTo = (request: Request, outcome: "ok" | "fout"): string => {
	const ourOrigin = publicOrigin(request);
	const fallback = new URL("/", ourOrigin);
	const referer = request.headers.get("referer");
	let target = fallback;
	if (referer) {
		const url = new URL(referer);
		if (url.origin === ourOrigin) target = url;
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

	// Staging only accepts a known set of domains. Refused before the bot checks
	// so whoever tests it gets a real answer instead of the fake success bots
	// see. The response is deliberately identical to a malformed address: the
	// error code is a response body a stranger can read, and "this domain is not
	// allowed" would tell them which domains are.
	if (!isAllowed(email)) return answer(400, false, "invalid_email");

	const ip =
		clientAddress ||
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
		"unknown";

	// Say "saved" and save nothing: a bot gets no signal to retune against.
	if (isBot(request, body, ip)) return answer(201, true);

	const confirmToken = newToken();
	const unsubscribeToken = newToken();

	try {
		// Same answer whether it was new or already there: "are you on this
		// list?" is not a question a stranger gets to ask.
		const created = store({ email, lang, source, confirmToken, unsubscribeToken });

		// Only a new row gets a mail. Repeating a signup must not be a way to
		// stuff someone's inbox.
		if (created) {
			try {
				await sendConfirmation({ email, lang, confirmToken, unsubscribeToken });
			} catch (error) {
				// A row nobody can confirm is a dead row: remove it and let the
				// visitor try again.
				console.error("[subscribe] could not send the confirmation mail", error);
				try {
					deleteByConfirmToken(confirmToken);
				} catch (cleanupError) {
					console.error("[subscribe] could not remove the unconfirmed row", cleanupError);
				}
				return answer(500, false, "server_error");
			}
		}

		return answer(201, true);
	} catch (error) {
		console.error("[subscribe] could not store address", error);
		return answer(500, false, "server_error");
	}
};
