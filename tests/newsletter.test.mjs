/**
 * Double opt-in over HTTP: the confirmation mail, the confirm link, the
 * unsubscribe link, and the rule that development never mails a real address.
 *
 * The SMTP sink in tests/helpers/smtp-sink.mjs is the only mail server these
 * tests can reach; the dev guard is what keeps it that way.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { post, withServer } from "./helpers/server.mjs";

const list = (dbPath) => {
	if (!existsSync(dbPath)) return [];
	const db = new DatabaseSync(dbPath);
	try {
		return db
			.prepare(
				"select email, confirmed_at, confirm_token, unsubscribe_token from subscribers order by created_at",
			)
			.all();
	} catch {
		return [];
	} finally {
		db.close();
	}
};

/** Nodemailer folds long lines and encodes parts; undo that before matching. */
const decode = (raw) => {
	const base64 = raw.replace(
		/Content-Transfer-Encoding: base64\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\n\r?\nContent-)/gi,
		(_, body) => Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8"),
	);
	return base64
		.replace(/=\r?\n/g, "")
		.replace(/=([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
};

const link = (raw, route) => {
	const match = decode(raw).match(new RegExp(`https?://[^\\s"'<>]+${route}\\?token=[a-f0-9]{64}`));
	assert.ok(match, `the mail has no ${route} link:\n${decode(raw)}`);
	return match[0];
};

const page = async (url) => {
	const response = await fetch(url);
	return { status: response.status, body: await response.text() };
};

test("a signup mails one confirmation link, and the link confirms once", async () => {
	await withServer(async ({ base, dbPath, smtp }) => {
		const signup = await post(base, { email: "Flow@Example.nl", lang: "nl", elapsed: 5000 });
		assert.equal(signup.status, 201);

		const rows = list(dbPath);
		assert.equal(rows.length, 1);
		assert.equal(rows[0].email, "flow@example.nl");
		assert.equal(rows[0].confirmed_at, null, "a signup is not a subscription");
		assert.match(rows[0].confirm_token, /^[a-f0-9]{64}$/);

		assert.equal(smtp.messages.length, 1, "exactly one mail per new address");
		const confirmUrl = link(smtp.messages[0], "/nieuwsbrief/bevestig");

		const first = await page(confirmUrl);
		assert.equal(first.status, 200);
		assert.match(first.body, /Inschrijving bevestigd/);
		assert.ok(list(dbPath)[0].confirmed_at, "the row is confirmed");
		assert.equal(list(dbPath)[0].confirm_token, null, "the token is burned");

		const second = await page(confirmUrl);
		const unknown = await page(`${base}/nieuwsbrief/bevestig?token=${"0".repeat(64)}`);
		assert.deepEqual(second, first, "a second click says exactly the same thing");
		assert.deepEqual(unknown, first, "an unknown token gives nothing away");
	});
});

test("an English signup is confirmed on the English route", async () => {
	await withServer(async ({ base, smtp }) => {
		assert.equal((await post(base, { email: "en@example.nl", lang: "en", elapsed: 5000 })).status, 201);

		const confirmUrl = link(smtp.messages[0], "/en/newsletter/confirm");
		const done = await page(confirmUrl);
		assert.equal(done.status, 200);
		assert.match(done.body, /Subscription confirmed/);
	});
});

test("a repeated signup does not send a second mail", async () => {
	await withServer(async ({ base, dbPath, smtp }) => {
		assert.equal((await post(base, { email: "again@example.nl", elapsed: 5000 })).status, 201);
		assert.equal((await post(base, { email: "again@example.nl", elapsed: 5000 })).status, 201);

		assert.equal(smtp.messages.length, 1);
		assert.equal(list(dbPath).length, 1);
	});
});

test("unsubscribe deletes the row and is safe to repeat", async () => {
	await withServer(async ({ base, dbPath, smtp }) => {
		assert.equal((await post(base, { email: "bye@example.nl", elapsed: 5000 })).status, 201);
		const unsubscribeUrl = link(smtp.messages[0], "/nieuwsbrief/afmelden");

		const first = await page(unsubscribeUrl);
		assert.equal(first.status, 200);
		assert.match(first.body, /Uitgeschreven/);
		assert.deepEqual(list(dbPath), [], "unsubscribing removes the address");

		const second = await page(unsubscribeUrl);
		const unknown = await page(`${base}/nieuwsbrief/afmelden?token=${"0".repeat(64)}`);
		assert.deepEqual(second, first);
		assert.deepEqual(unknown, first);
	});
});

test("a non-loopback SMTP host is refused in development", async () => {
	await withServer(
		async ({ base, dbPath, smtp }) => {
			const signup = await post(base, { email: "leak@example.nl", elapsed: 5000 });
			assert.equal(signup.status, 500, "the guard must fail the signup loudly");
			assert.deepEqual(list(dbPath), [], "no dead unconfirmed row is left behind");
			assert.equal(smtp.messages.length, 0);
		},
		{ env: { SMTP_URL: "smtp://smtp.example.com:25" } },
	);
});

test("production without SMTP_URL refuses to send instead of falling back", async () => {
	await withServer(
		async ({ base, dbPath, smtp }) => {
			const signup = await post(base, { email: "prod@example.nl", elapsed: 5000 });
			assert.equal(signup.status, 500);
			assert.deepEqual(list(dbPath), []);
			assert.equal(smtp.messages.length, 0);
		},
		{ env: { NODE_ENV: "production", SMTP_URL: "" } },
	);
});
