/**
 * Removing addresses the sending server says are dead.
 *
 * Two mistakes matter and both are silent: keeping a dead address (every send
 * pays for it, and repeated bounces hurt the sending reputation), and removing a
 * live one (a person who signed up and hears nothing again). The parser is
 * therefore tested against real Postfix lines, and against the deferral that
 * looks almost identical to a bounce.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parseBounces } from "../src/lib/bounces.ts";

const SCRIPT = fileURLToPath(new URL("../scripts/bounces.mjs", import.meta.url));

/** Lines copied from the shape Postfix writes on this host. */
const hardBounce =
	"2026-11-05T14:38:23.628177+00:00 vps1 postfix/smtp[942084]: 98F29493A2: " +
	"to=<dead@example.nl>, relay=mx.example.nl[1.2.3.4]:25, delay=2.7, delays=0/0/0.2/2.5, " +
	"dsn=5.1.1, status=bounced (host mx.example.nl said: 550 5.1.1 unknown user)";
const deferral =
	"2026-11-05T14:38:23.628177+00:00 vps1 postfix/smtp[942085]: A1B2C3: " +
	"to=<busy@example.nl>, relay=mx.example.nl[1.2.3.4]:25, delay=1, delays=0/0/0/1, " +
	"dsn=4.2.2, status=deferred (mailbox full)";
const delivered =
	"2026-11-05T14:38:23.628177+00:00 vps1 postfix/smtp[942086]: D4E5F6: " +
	"to=<fine@example.nl>, relay=mx.example.nl[1.2.3.4]:25, delay=3, delays=0/0/1/2, " +
	"dsn=2.0.0, status=sent (250 2.0.0 Ok: queued as 1234)";
const unrelated =
	"2026-11-05T14:38:21.527402+00:00 vps1 postfix/pickup[941425]: 7FEA248FB6: uid=0 from=<bounce@bakmark.nl>";

/** An empty list with the columns the app creates. */
const emptyList = (dbPath) => {
	const db = new DatabaseSync(dbPath);
	db.exec(`
		CREATE TABLE subscribers (
			email TEXT PRIMARY KEY, lang TEXT NOT NULL, source TEXT,
			created_at TEXT NOT NULL, confirmed_at TEXT, confirm_token TEXT,
			confirm_sent_at TEXT, unsubscribe_token TEXT
		);
	`);
	return db;
};

/** Feed the job a log on stdin, exactly the way the cron line does. */
const sweep = (dbPath, input) =>
	execFileSync(process.execPath, ["--experimental-strip-types", SCRIPT], {
		env: { ...process.env, SUBSCRIBERS_DB: dbPath },
		input,
		encoding: "utf8",
	});

test("a hard bounce is hard, a deferral is not", () => {
	const report = parseBounces([hardBounce, deferral, delivered, unrelated].join("\n"));

	assert.deepEqual(report.hard.map((bounce) => bounce.email), ["dead@example.nl"]);
	assert.equal(report.hard[0].dsn, "5.1.1");
	assert.match(report.hard[0].reason, /unknown user/);
	assert.deepEqual(report.soft.map((bounce) => bounce.email), ["busy@example.nl"]);
	assert.equal(report.delivered, 1, "a sent line is not a bounce");
});

test("an expired queue entry is soft: five days of trying is not proof of death", () => {
	const expired =
		"2026-11-05T10:00:00.000000+00:00 vps1 postfix/bounce[1]: 99AA: to=<slow@example.nl>, " +
		"relay=none, delay=432000, delays=0/0/0/432000, dsn=4.4.7, status=expired (delivery temporarily suspended)";
	const report = parseBounces(expired);
	assert.deepEqual(report.hard, []);
	assert.equal(report.soft.length, 1);
});

test("the same address twice is one removal", () => {
	const report = parseBounces([hardBounce, hardBounce].join("\n"));
	assert.equal(report.hard.length, 1);
});

test("bounces for nobody, and lines with no dsn, are ignored", () => {
	const report = parseBounces(
		[
			"2026-11-05T10:00:00.000000+00:00 vps1 postfix/bounce[1]: 11: to=<>, dsn=5.0.0, status=bounced (double bounce)",
			"2026-11-05T10:00:00.000000+00:00 vps1 postfix/smtpd[2]: connect from unknown[10.0.0.1]",
		].join("\n"),
	);
	assert.deepEqual(report.hard, []);
	assert.deepEqual(report.soft, []);
});

test("the job removes a hard bounce and keeps a deferral, in the real database", () => {
	const root = mkdtempSync(join(tmpdir(), "bakmark-bounces-"));
	const dbPath = join(root, "subscribers.sqlite");

	try {
		const db = emptyList(dbPath);
		const insert = db.prepare(
			"INSERT INTO subscribers (email, lang, source, created_at, confirmed_at) VALUES (?, ?, ?, ?, ?)",
		);
		const now = new Date().toISOString();
		insert.run("dead@example.nl", "nl", "/", now, now);
		insert.run("busy@example.nl", "nl", "/", now, now);
		insert.run("fine@example.nl", "nl", "/", now, now);
		db.close();

		const stdout = sweep(dbPath, [hardBounce, deferral, delivered].join("\n"));

		assert.match(stdout, /removed dead@example\.nl \(5\.1\.1\)/);
		assert.match(stdout, /1 hard bounce\(s\), 1 removed; 1 soft \(kept\); 1 delivered/);

		const after = new DatabaseSync(dbPath);
		const left = after
			.prepare("SELECT email FROM subscribers ORDER BY email")
			.all()
			.map((row) => row.email);
		after.close();
		assert.deepEqual(left, ["busy@example.nl", "fine@example.nl"]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("an empty list is quiet: nothing to remove is not a fault", () => {
	const root = mkdtempSync(join(tmpdir(), "bakmark-bounces-quiet-"));
	const dbPath = join(root, "subscribers.sqlite");

	try {
		emptyList(dbPath).close();
		const stdout = sweep(dbPath, hardBounce);
		assert.match(stdout, /the list is empty; nothing to remove/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("a bounce that matches nobody in a list that is not empty fails loudly", () => {
	const root = mkdtempSync(join(tmpdir(), "bakmark-bounces-empty-"));
	const dbPath = join(root, "subscribers.sqlite");

	try {
		const db = emptyList(dbPath);
		const now = new Date().toISOString();
		db.prepare(
			"INSERT INTO subscribers (email, lang, source, created_at, confirmed_at) VALUES (?, ?, ?, ?, ?)",
		).run("someone@example.nl", "nl", "/", now, now);
		db.close();

		let failure;
		try {
			sweep(dbPath, hardBounce);
		} catch (error) {
			failure = error;
		}

		assert.ok(failure, "an empty list plus a bounce is a wrong database, not a success");
		assert.match(String(failure.stderr), /check SUBSCRIBERS_DB/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
