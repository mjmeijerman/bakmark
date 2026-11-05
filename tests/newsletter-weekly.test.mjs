/**
 * The weekly newsletter, run the way cron runs it.
 *
 * The things that matter are not in the mail builder: only confirmed addresses
 * are mailed, each in its own language with its own unsubscribe link, a video
 * goes out exactly once, and a week with nothing new sends nothing. A
 * newsletter that repeats itself, or mails people who never confirmed, empties
 * the list faster than any missing feature.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { startSink } from "./helpers/smtp-sink.mjs";

const run = promisify(execFile);
const SCRIPT = fileURLToPath(new URL("../scripts/newsletter.mjs", import.meta.url));

/**
 * Nodemailer base64-encodes a plain part and quoted-printable-encodes an html
 * part; undo both before matching, or every tag reads =3Ctd=3E.
 */
const decode = (raw) =>
	raw
		.replace(
			/Content-Transfer-Encoding: base64\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\n\r?\nContent-)/gi,
			(_, body) => Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8"),
		)
		.replace(/=\r?\n/g, "")
		.replace(/=([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));

const recipe = (slug, title, video) => ({ slug, title, published: "2026-10-29", video });

/** A list with the columns the app creates, so the script reads the real shape. */
const subscribers = (dbPath, rows) => {
	const db = new DatabaseSync(dbPath);
	db.exec(`
		CREATE TABLE IF NOT EXISTS subscribers (
			email TEXT PRIMARY KEY,
			lang TEXT NOT NULL,
			source TEXT,
			created_at TEXT NOT NULL,
			confirmed_at TEXT,
			confirm_token TEXT,
			confirm_sent_at TEXT,
			unsubscribe_token TEXT
		);
	`);
	const insert = db.prepare(
		`INSERT INTO subscribers (email, lang, source, created_at, confirmed_at, unsubscribe_token)
		 VALUES (?, ?, ?, ?, ?, ?)`,
	);
	const now = new Date().toISOString();
	for (const row of rows) {
		insert.run(row.email, row.lang ?? "nl", "/", now, row.confirmed ? now : null, row.token ?? null);
	}
	db.close();
};

/** A checkout with recipes and a data directory, which is all the job reads. */
const workspace = (recipes, subscribersRows = undefined) => {
	const root = mkdtempSync(join(tmpdir(), "bakmark-newsletter-"));
	const dir = join(root, "recipes");
	mkdirSync(dir, { recursive: true });
	for (const entry of recipes) writeFileSync(join(dir, `${entry.slug}.json`), JSON.stringify(entry));

	const dbPath = join(root, "data", "subscribers.sqlite");
	mkdirSync(join(root, "data"), { recursive: true });
	subscribers(dbPath, subscribersRows ?? []);

	return {
		root,
		dbPath,
		stateFile: join(root, "data", "videos-mailed.json"),
		cleanup: () => rmSync(root, { recursive: true, force: true }),
	};
};

const newsletter = async (space, smtp, extra = [], env = {}) =>
	run(process.execPath, ["--experimental-strip-types", SCRIPT, ...extra], {
		cwd: space.root,
		env: {
			...process.env,
			SUBSCRIBERS_DB: space.dbPath,
			NEWSLETTER_STATE: space.stateFile,
			SITE_URL: "https://bakmark.nl",
			SMTP_URL: smtp.url,
			MAIL_FROM: "Bakmark <noreply@news.bakmark.nl>",
			...env,
		},
	});

test("only confirmed addresses are mailed, each in its own language", async () => {
	const smtp = await startSink();
	const space = workspace(
		[
			recipe("soezenbeslag", "Soezenbeslag", { status: "gepubliceerd", youtube_id: "aaa111" }),
			recipe("soesjes", "Soesjes", { status: "gepubliceerd", youtube_id: "bbb222" }),
			recipe("slagroom", "Slagroom", { status: "concept", youtube_id: null }),
			// An id without "gepubliceerd" is a private upload, not a video a viewer has.
			recipe("zwitserse-room", "Zwitserse room", { status: "opgenomen", youtube_id: "ccc333" }),
		],
		[
			{ email: "nl@example.nl", lang: "nl", confirmed: true, token: "tok-nl" },
			{ email: "en@example.nl", lang: "en", confirmed: true, token: "tok-en" },
			// Typed, never confirmed: it only ever asked for the confirmation link.
			{ email: "pending@example.nl", lang: "nl", confirmed: false, token: "tok-pending" },
		],
	);

	try {
		const first = await newsletter(space, smtp);
		// Two new recipes, one mail, not one mail per recipe.
		assert.match(first.stdout, /2 new recipe\(s\) to 2\/2 subscriber\(s\): soesjes, soezenbeslag/);
		assert.equal(smtp.messages.length, 2, "one mail per confirmed subscriber");

		const dutch = decode(smtp.messages[0]);
		const english = decode(smtp.messages[1]);
		assert.match(dutch, /Nieuwe recepten op Bakmark \(2\)/);
		assert.match(dutch, /Er staan 2 nieuwe recepten op Bakmark\./);
		for (const slug of ["soesjes", "soezenbeslag"]) {
			assert.match(dutch, new RegExp(`https://bakmark\\.nl/recepten/${slug}`));
			// One picture per recipe, the same stand-in the card on /recepten shows.
			assert.match(
				dutch,
				new RegExp(
					`<a href="https://bakmark\\.nl/recepten/${slug}"[^>]*><img src="https://bakmark\\.nl/recept-placeholder\\.png" alt="[^"]+" width="472"`,
				),
			);
		}
		assert.match(dutch, /Uitschrijven/);
		assert.match(dutch, /afmelden\?token=tok-nl/);
		assert.match(english, /New recipes on Bakmark \(2\)/);
		assert.match(english, /unsubscribe\?token=tok-en/);

		for (const raw of smtp.messages) {
			// Headers are folded at 78 columns; unfold before matching one.
			const unfolded = raw.replace(/\r?\n[ \t]+/g, " ");
			// The video is embedded on the page; a watch link goes past the recipe.
			assert.doesNotMatch(raw, /youtube\.com/);
			assert.doesNotMatch(raw, /pending@example\.nl/, "an unconfirmed address is never mailed");
			assert.doesNotMatch(raw, /Slagroom/);
			assert.match(unfolded, /^List-Unsubscribe: <https:\/\/bakmark\.nl\//m);
		}

		const state = JSON.parse(readFileSync(space.stateFile, "utf8"));
		assert.deepEqual(state.youtube_ids.sort(), ["aaa111", "bbb222"]);
		assert.ok(state.reported_at);

		// Second week, same deployment: nothing new, so nothing is sent.
		const second = await newsletter(space, smtp);
		assert.match(second.stdout, /0 new; nothing sent/);
		assert.equal(smtp.messages.length, 2, "a quiet week sends nothing");
	} finally {
		await smtp.close();
		space.cleanup();
	}
});

test("a video published after the last newsletter is the only one mailed", async () => {
	const smtp = await startSink();
	const space = workspace(
		[recipe("soesjes", "Soesjes", { status: "gepubliceerd", youtube_id: "aaa111" })],
		[{ email: "nl@example.nl", lang: "nl", confirmed: true, token: "tok-nl" }],
	);

	try {
		await newsletter(space, smtp);

		writeFileSync(
			join(space.root, "recipes", "banketbakkersroom.json"),
			JSON.stringify(
				recipe("banketbakkersroom", "Banketbakkersroom", {
					status: "gepubliceerd",
					youtube_id: "ddd444",
				}),
			),
		);

		const next = await newsletter(space, smtp);
		assert.match(next.stdout, /1 new recipe\(s\)/);
		assert.equal(smtp.messages.length, 2);

		const text = decode(smtp.messages[1]);
		assert.match(text, /Banketbakkersroom/);
		assert.doesNotMatch(text, /aaa111|Soesjes/, "last week's video is not repeated");
	} finally {
		await smtp.close();
		space.cleanup();
	}
});

test("an empty list sends nothing and records nothing", async () => {
	const smtp = await startSink();
	const space = workspace([
		recipe("soesjes", "Soesjes", { status: "gepubliceerd", youtube_id: "aaa111" }),
	]);

	try {
		const result = await newsletter(space, smtp);
		assert.match(result.stdout, /the list is empty; nothing sent/);
		assert.equal(smtp.messages.length, 0);
		assert.equal(
			existsSync(space.stateFile),
			false,
			"the first subscriber should get the back catalogue, not an empty week",
		);
	} finally {
		await smtp.close();
		space.cleanup();
	}
});

test("--preview shows every recipe with a video to one address, and records nothing", async () => {
	const smtp = await startSink();
	const space = workspace([
		recipe("soesjes", "Soesjes", { status: "gepubliceerd", youtube_id: "aaa111" }),
		recipe("slagroom", "Slagroom", { status: "concept", youtube_id: null }),
		recipe("banketbakkersroom", "Banketbakkersroom", { status: "opgenomen", youtube_id: null }),
	]);

	try {
		const preview = await newsletter(space, smtp, ["--preview", "maker@example.nl"]);
		assert.match(preview.stdout, /preview with 3 recipe\(s\) to maker@example\.nl; snapshot untouched/);
		assert.equal(smtp.messages.length, 1, "a preview goes to exactly one address");

		const text = decode(smtp.messages[0]);
		assert.match(text, /Testmail met alle 3 recepten/);
		assert.match(text, /Slagroom \(concept\)/);
		assert.match(text, /Banketbakkersroom \(opgenomen\)/);
		assert.match(text, /Soesjes$/m, "a published recipe carries no status note");
		assert.doesNotMatch(text, /Uitschrijven/, "a preview has no row to unsubscribe");
		assert.doesNotMatch(smtp.messages[0], /List-Unsubscribe/);
		assert.equal(existsSync(space.stateFile), false);
	} finally {
		await smtp.close();
		space.cleanup();
	}
});

test("--hour makes the job silent outside its own hour", async () => {
	const smtp = await startSink();
	const space = workspace(
		[recipe("soesjes", "Soesjes", { status: "gepubliceerd", youtube_id: "aaa111" })],
		[{ email: "nl@example.nl", lang: "nl", confirmed: true, token: "tok-nl" }],
	);

	const now = Number(
		new Intl.DateTimeFormat("en-GB", {
			timeZone: "Europe/Amsterdam",
			hour: "2-digit",
			hour12: false,
		}).format(new Date()),
	);
	const other = String((now + 3) % 24);

	try {
		const skipped = await newsletter(space, smtp, ["--hour", other]);
		assert.match(skipped.stdout, /nothing done/);
		assert.equal(smtp.messages.length, 0, "the wrong side of daylight saving sends nothing");
		assert.equal(existsSync(space.stateFile), false, "a skipped run leaves the snapshot alone");

		const sent = await newsletter(space, smtp, ["--hour", String(now)]);
		assert.match(sent.stdout, /1 new recipe\(s\) to 1\/1/);
		assert.equal(smtp.messages.length, 1);
	} finally {
		await smtp.close();
		space.cleanup();
	}
});

test("when no mail gets out, the snapshot is kept and the job fails", async () => {
	const space = workspace(
		[recipe("soesjes", "Soesjes", { status: "gepubliceerd", youtube_id: "aaa111" })],
		[{ email: "nl@example.nl", lang: "nl", confirmed: true, token: "tok-nl" }],
	);

	try {
		// A port with nothing on it: the send throws, for every recipient.
		const failure = await newsletter(space, { url: "smtp://127.0.0.1:1" }).then(
			() => assert.fail("a run that sent nothing must not look like a success"),
			(error) => error,
		);
		assert.match(failure.stderr, /snapshot kept/);
		assert.equal(
			existsSync(space.stateFile),
			false,
			"recording a send that never happened would drop these videos for good",
		);
	} finally {
		space.cleanup();
	}
});
