/**
 * The promises the confirmation mail makes, and the job that keeps them.
 *
 * Two things are asserted here that a wording change could quietly break:
 * the logo links home, and the retention sentence is the same number the
 * purge uses. A mail that promises "after 24 hours" while the job deletes later
 * is worse than no sentence at all.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { promisify } from "node:util";
import { post, withServer } from "./helpers/server.mjs";

const run = promisify(execFile);

// The retention window, read from the source the app and the purge share. A
// hard-coded 7 here would pass while the mail said something else.
const { UNCONFIRMED_TTL_HOURS } = await import("../src/lib/config.ts");

/** Nodemailer folds and base64-encodes parts; undo that before matching. */
const decode = (raw) =>
	raw
		.replace(
			/Content-Transfer-Encoding: base64\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\n\r?\nContent-)/gi,
			(_, body) => Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8"),
		)
		.replace(/=\r?\n/g, "")
		.replace(/=([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));

const list = (dbPath) => {
	const db = new DatabaseSync(dbPath);
	try {
		return db.prepare("select email, created_at, confirmed_at from subscribers").all();
	} finally {
		db.close();
	}
};

test("the mail shows the logo, and the logo links to the homepage", async () => {
	await withServer(async ({ base, smtp }) => {
		assert.equal((await post(base, { email: "logo@example.nl", elapsed: 5000 })).status, 201);

		const html = decode(smtp.messages[0]);
		const anchor = html.match(/<a href="([^"]+)"[^>]*>\s*<img src="([^"]+)"/);
		assert.ok(anchor, "no linked logo in the html part");
		assert.equal(anchor[1], base, "the logo links to the site root");
		assert.equal(anchor[2], `${base}/logo-bakmark.png`);

		// The image must actually be served, or every client shows a broken logo.
		const image = await fetch(anchor[2]);
		assert.equal(image.status, 200);
		assert.match(image.headers.get("content-type") ?? "", /image\/png/);
	});
});

test("the mail says when an unconfirmed address is deleted, in both languages", async () => {
	await withServer(async ({ base, smtp }) => {
		assert.equal((await post(base, { email: "nl@example.nl", lang: "nl", elapsed: 5000 })).status, 201);
		assert.equal((await post(base, { email: "en@example.nl", lang: "en", elapsed: 5000 })).status, 201);

		const [dutch, english] = [decode(smtp.messages[0]), decode(smtp.messages[1])];
		assert.match(dutch, /verwijderen we je e-mailadres na 24 uur/);
		assert.match(english, /we delete your email address after 24 hours/);
		assert.doesNotMatch(dutch, /verdwijnen vanzelf/);
		assert.doesNotMatch(english, /disappears on its own/);
	});
});

test("the purge deletes only old, unconfirmed rows", async () => {
	// Run the script against the server's database after stopping it: the file
	// is the contract, and the script is what cron will call.
	let dbPath;
	await withServer(
		async (context) => {
			dbPath = context.dbPath;
			const { base } = context;
			assert.equal((await post(base, { email: "fresh@example.nl", elapsed: 5000 })).status, 201);

			// A confirmed row and an old unconfirmed row, written by hand.
			const db = new DatabaseSync(dbPath);
			const insert = db.prepare(
				"insert into subscribers (email, lang, source, created_at, confirmed_at) values (?, ?, ?, ?, ?)",
			);
			const old = new Date(Date.now() - (UNCONFIRMED_TTL_HOURS + 1) * 3_600_000).toISOString();
			insert.run("old@example.nl", "nl", "/", old, null);
			insert.run("kept@example.nl", "nl", "/", old, new Date().toISOString());
			db.close();
		},
		// Keep the directory so the purge below can still read the file.
		{ keep: true },
	);

	assert.ok(dbPath && existsSync(dbPath), "the test database should have been kept");
	const { stdout } = await run(
		process.execPath,
		["--experimental-strip-types", "scripts/purge.mjs"],
		{ env: { ...process.env, SUBSCRIBERS_DB: dbPath } },
	);

	assert.match(stdout, /removed 1 unconfirmed address/);
	const remaining = list(dbPath).map((row) => row.email).sort();
	assert.deepEqual(remaining, ["fresh@example.nl", "kept@example.nl"], "only the expired unconfirmed row went");
});
