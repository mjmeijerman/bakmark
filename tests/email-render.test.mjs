/**
 * What the confirmation mail actually looks like once it leaves the app.
 *
 * The unit-ish checks in retention.test.mjs prove the logo and the retention
 * sentence are in the message. This file goes further: it parses the real
 * MIME the server sent, asserts the parts a mail client needs (both a text
 * and an html alternative, a valid subject, a real image), and — when
 * JSoup is on the machine — renders the extra HTML a mail rule matches, with
 * a screenshot that is diffed against a committed baseline.
 *
 * No baseline image in the repo yet? Set UPDATE_SNAPSHOTS=1 to write one:
 *
 *   UPDATE_SNAPSHOTS=1 node --test tests/email-render.test.mjs
 *
 * The visual part is skipped (not failed) when no headless browser is
 * available, so CI stays green on a box without one; everything structural
 * still runs.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { post, withServer } from "./helpers/server.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(HERE, "..");
const SNAPSHOT_DIR = join(HERE, "snapshots");
const UPDATE = process.env.UPDATE_SNAPSHOTS === "1";

/**
 * Split a captured SMTP message into its headers and its decoded parts.
 * Hand-rolled on purpose: no dependency, and the shape we send is simple
 * enough (multipart/alternative with two base64 parts).
 */
const parseMessage = (raw) => {
	const [head] = raw.split(/\r?\n\r?\n/);
	const header = (name) => {
		const match = head.match(new RegExp(`^${name}:\\s*(.*(?:\\r?\\n[ \\t].*)*)`, "im"));
		return match ? match[1].replace(/\r?\n[ \t]+/g, " ").trim() : "";
	};

	// Only the boundary line itself separates parts; a "--" inside content
	// (or inside a URL) must not split anything.
	const boundary = (head.match(/boundary="?([^";\r\n]+)"?/i) ?? [])[1];
	const parts = {};
	const chunks = boundary ? raw.split(new RegExp(`\\r?\\n--${boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)) : [];
	for (const chunk of chunks.slice(1)) {
		const [partHead, ...rest] = chunk.split(/\r?\n\r?\n/);
		const type = (partHead.match(/Content-Type:\s*([\w/+.-]+)/i) ?? [])[1];
		if (!type) continue;
		const body = rest.join("\n\n").replace(/\r?\n--\s*$/, "");
		const encoding = (partHead.match(/Content-Transfer-Encoding:\s*(\S+)/i) ?? [])[1] ?? "7bit";
		parts[type.toLowerCase()] =
			encoding.toLowerCase() === "base64"
				? Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8")
				: encoding.toLowerCase() === "quoted-printable"
					? decodeQuotedPrintable(body)
					: body;
	}

	return {
		headers: {
			subject: header("Subject"),
			to: header("To"),
			from: header("From"),
			contentType: header("Content-Type"),
		},
		text: parts["text/plain"] ?? "",
		html: parts["text/html"] ?? "",
		hasTextPart: "text/plain" in parts,
		hasHtmlPart: "text/html" in parts,
	};
};

/** Quoted-printable: soft line breaks, then =XX byte escapes. */
const decodeQuotedPrintable = (body) => {
	const bytes = [];
	const unfolded = body.replace(/=\r?\n/g, "");
	for (let i = 0; i < unfolded.length; i++) {
		const char = unfolded[i];
		if (char === "=" && /^[0-9a-f]{2}$/i.test(unfolded.slice(i + 1, i + 3))) {
			bytes.push(Number.parseInt(unfolded.slice(i + 1, i + 3), 16));
			i += 2;
		} else {
			bytes.push(char.charCodeAt(0));
		}
	}
	return Buffer.from(bytes).toString("utf8");
};

/** True when a binary is runnable. */
const has = (bin) => {
	try {
		execFileSync("sh", ["-c", `command -v ${bin}`], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
};

test("the message is well-formed MIME with a text and an html part", async () => {
	await withServer(async ({ base, smtp }) => {
		assert.equal((await post(base, { email: "mime@example.nl", lang: "nl", elapsed: 5000 })).status, 201);

		const mail = parseMessage(smtp.messages[0]);
		assert.match(mail.headers.subject, /^Bevestig je inschrijving voor de nieuwsbrief$/);
		assert.match(mail.headers.to, /mime@example\.nl/);
		assert.match(mail.headers.from, /@/, "a mail without From is rejected by many servers");
		assert.match(mail.headers.contentType, /multipart\/alternative/i);
		assert.ok(mail.hasTextPart, "no text/plain part: plain-text readers get nothing");
		assert.ok(mail.hasHtmlPart, "no text/html part: the mail has no logo or button");
	});
});

test("every promise of the mail is in both parts, in the reader's language", async () => {
	await withServer(async ({ base, smtp }) => {
		assert.equal((await post(base, { email: "nl@example.nl", lang: "nl", elapsed: 5000 })).status, 201);
		assert.equal((await post(base, { email: "en@example.nl", lang: "en", elapsed: 5000 })).status, 201);

		const [dutch, english] = smtp.messages.map(parseMessage);

		for (const [mail, lang] of [
			[dutch, "nl"],
			[english, "en"],
		]) {
			// The action a reader must be able to take, in both parts.
			for (const body of [mail.text, mail.html]) {
				assert.match(body, new RegExp(`/newsletter/|/nieuwsbrief/`), `${lang}: no confirm link`);
				assert.match(body, lang === "nl" ? /Uitschrijven/ : /Unsubscribe/, `${lang}: no unsubscribe`);
			}
			assert.equal(mail.html.match(/<a href="[^"]*\/(nieuwsbrief|newsletter)\/(bevestig|confirm)\?token=/g)?.length, 1, `${lang}: exactly one confirm link`);
		}

		assert.match(dutch.html, /lang="nl"/);
		assert.match(english.html, /lang="en"/);
		assert.match(dutch.text, /verwijderen we je e-mailadres na 24 uur/);
		assert.match(english.text, /we delete your email address after 24 hours/);
	});
});

test("the html is self-contained and friendly to mail clients", async () => {
	await withServer(async ({ base, smtp }) => {
		assert.equal((await post(base, { email: "style@example.nl", elapsed: 5000 })).status, 201);
		const { html } = parseMessage(smtp.messages[0]);

		assert.match(html, /^<!doctype html>/i);
		// No <style> blocks or external CSS: Gmail strips them.
		assert.doesNotMatch(html, /<style[\s>]/i);
		assert.doesNotMatch(html, /<link[^>]+stylesheet/i);
		// No scripts: every client blocks them, and a spam filter notices.
		assert.doesNotMatch(html, /<script/i);
		// One image, with width and alt so it never collapses to a giant blob.
		const images = html.match(/<img [^>]*>/g) ?? [];
		assert.equal(images.length, 1);
		assert.match(images[0], /width="160"/);
		assert.match(images[0], /alt="[^"]+"/);
		assert.match(images[0], /height:auto/);
		// Every link is absolute: relative links are dead in a mail client.
		for (const href of html.match(/href="([^"]+)"/g) ?? []) {
			assert.match(href, /href="https?:\/\/[^"]+"/, `relative link in mail: ${href}`);
		}
		// The layout is a table, not a div stack: Outlook ignores most div CSS.
		assert.match(html, /<table role="presentation"/);
		// Properties Mailpit's caniemail check flags as unsupported by whole
		// platforms. Each one was a real defect, not a style preference:
		// opacity/max-height/overflow hid the preheader on 20+ clients,
		// max-width broke the container in Outlook Windows, outline did
		// nothing in 9 clients, and body styling is ignored by webmails.
		for (const banned of [
			/\bopacity:/i,
			/\bmax-height:/i,
			/\boverflow:/i,
			/\boutline:/i,
			/\bmax-width:\s*100%/i,
		]) {
			assert.doesNotMatch(html, banned, `unsupported property in mail: ${banned}`);
		}
		assert.doesNotMatch(html, /<body[^>]*style="[^"]*background/i, "body background does not render in several webmails");
		assert.match(html, /<table[^>]*bgcolor="#f6f1e7"/, "the background belongs on the outer table");
	});
});

/**
 * A headless Chromium, from PATH or from Playwright's cache. The cache is
 * checked because a developer machine usually has one, and the visual check is
 * the only way to notice a mail that renders as a wall of text.
 */
const findBrowser = () => {
	const fromPath = ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"].find(has);
	if (fromPath) return fromPath;

	const cache = join(process.env.HOME ?? "", ".cache", "ms-playwright");
	if (!existsSync(cache)) return undefined;

	// Plain directory walking: a shell `find` would need quoting that depends
	// on how this file is loaded, which is not worth the fragility.
	const known = [
		"chrome-linux64/chrome",
		"chrome-linux/chrome",
		"chrome-headless-shell-linux64/chrome-headless-shell",
	];
	const versions = readdirSync(cache).filter((entry) => entry.startsWith("chromium"));
	for (const version of versions) {
		for (const candidate of known) {
			const path = join(cache, version, candidate);
			if (existsSync(path)) return path;
		}
	}

	return undefined;
};

test("rendering the html produces the same pixels as the baseline", async (t) => {
	const browser = findBrowser();
	if (!browser) {
		t.skip("no headless browser on this machine; structural checks above still ran");
		return;
	}

	await withServer(async ({ base, smtp }) => {
		assert.equal((await post(base, { email: "shot@example.nl", lang: "nl", elapsed: 5000 })).status, 201);
		const { html } = parseMessage(smtp.messages[0]);

		mkdirSync(SNAPSHOT_DIR, { recursive: true });
		const htmlPath = join(SNAPSHOT_DIR, "confirmation.nl.html");
		const shotPath = join(SNAPSHOT_DIR, "confirmation.nl.png");
		const baseline = join(SNAPSHOT_DIR, "confirmation.nl.baseline.png");

		// Tokens differ on every run; freeze them so the image is stable.
		writeFileSync(htmlPath, html.replace(/[a-f0-9]{64}/g, "0".repeat(64)));

		// No test server is running now: the logo URL points at the throwaway
		// port from the signup. Swap it for the real file so the screenshot
		// shows the mail, not a broken image icon. A finite timeout keeps a
		// browser that never exits from hanging the whole suite.
		const withLocalLogo = readFileSync(htmlPath, "utf8").replace(
			/http:\/\/[^"'\s]+\/logo-bakmark\.png/,
			`file://${join(ROOT, "public", "logo-bakmark.png")}`,
		);
		writeFileSync(htmlPath, withLocalLogo);

		execFileSync(
			browser,
			[
				"--headless",
				"--disable-gpu",
				"--no-sandbox",
				"--hide-scrollbars",
				"--force-device-scale-factor=1",
				"--window-size=600,800",
				`--screenshot=${shotPath}`,
				`file://${htmlPath}`,
			],
			{ stdio: "ignore", timeout: 60_000 },
		);

		assert.ok(existsSync(shotPath), "the browser produced no screenshot");

		if (UPDATE || !existsSync(baseline)) {
			writeFileSync(baseline, readFileSync(shotPath));
			t.diagnostic(`baseline written: ${baseline}`);
			return;
		}

		assert.deepEqual(
			readFileSync(shotPath),
			readFileSync(baseline),
			"the rendered mail changed; review it, then UPDATE_SNAPSHOTS=1 to accept",
		);
	});
});
