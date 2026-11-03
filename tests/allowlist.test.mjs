/**
 * The staging allowlist.
 *
 * Staging runs the real form and can reach a real mail server, so the gate has
 * to hold before anything is stored or sent. These tests assert both
 * directions: an allowed domain goes through, a refused one leaves no row and
 * sends nothing, and an unset variable means no restriction at all.
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
		return db.prepare("select email from subscribers order by created_at").all().map((r) => r.email);
	} finally {
		db.close();
	}
};

const allowOnly = { env: { SIGNUP_ALLOWED_DOMAINS: "markmeijerman.eu,mail-tester.com" } };

test("an allowed domain is stored and mailed", async () => {
	await withServer(async ({ base, dbPath, smtp }) => {
		const response = await post(base, { email: "Test@MarkMeijerman.eu", elapsed: 5000 });
		assert.equal(response.status, 201);
		assert.deepEqual(await response.json(), { ok: true });
		assert.deepEqual(list(dbPath), ["test@markmeijerman.eu"], "stored lowercased");
		assert.equal(smtp.messages.length, 1, "the confirmation mail went out");
	}, allowOnly);
});

test("both allowed domains work, including the one used for deliverability checks", async () => {
	await withServer(async ({ base, smtp }) => {
		assert.equal((await post(base, { email: "a@markmeijerman.eu", elapsed: 5000 })).status, 201);
		assert.equal((await post(base, { email: "b@mail-tester.com", elapsed: 5000 })).status, 201);
		assert.equal(smtp.messages.length, 2);
	}, allowOnly);
});

test("a refused domain is rejected, stored nowhere and not mailed", async () => {
	await withServer(async ({ base, dbPath, smtp }) => {
		for (const email of ["someone@gmail.com", "x@example.nl", "y@notmarkmeijerman.eu"]) {
			const response = await post(base, { email, elapsed: 5000 });
			assert.equal(response.status, 400, `${email} should be refused`);
			// Indistinguishable from a malformed address: the response must not
			// reveal that an allowlist exists or which domains are on it.
			assert.deepEqual(await response.json(), { ok: false, error: "invalid_email" }, email);
		}
		assert.deepEqual(list(dbPath), [], "nothing may be stored");
		assert.equal(smtp.messages.length, 0, "nothing may be mailed");
	}, allowOnly);
});

test("a refused domain is indistinguishable from a malformed address", async () => {
	await withServer(async ({ base }) => {
		const refused = await post(base, { email: "someone@gmail.com", elapsed: 5000 });
		const malformed = await post(base, { email: "not-an-address", elapsed: 5000 });

		assert.equal(refused.status, malformed.status, "same status");
		assert.deepEqual(await refused.json(), await malformed.json(), "same body");
		assert.equal(refused.headers.get("content-type"), malformed.headers.get("content-type"));
	}, allowOnly);
});

test("a look-alike domain does not slip through", async () => {
	await withServer(async ({ base, dbPath, smtp }) => {
		// Would pass a naive endsWith() check.
		for (const email of ["a@evilmarkmeijerman.eu", "b@markmeijerman.eu.evil.com"]) {
			const response = await post(base, { email, elapsed: 5000 });
			assert.equal(response.status, 400, `${email} must not pass the allowlist`);
		}
		assert.deepEqual(list(dbPath), []);
		assert.equal(smtp.messages.length, 0);
	}, allowOnly);
});

test("a subdomain of an allowed domain is accepted", async () => {
	await withServer(async ({ base, smtp }) => {
		assert.equal((await post(base, { email: "a@staging.markmeijerman.eu", elapsed: 5000 })).status, 201);
		assert.equal(smtp.messages.length, 1);
	}, allowOnly);
});

test("an unset allowlist does not restrict anything", async () => {
	await withServer(async ({ base, dbPath }) => {
		assert.equal((await post(base, { email: "anyone@example.org", elapsed: 5000 })).status, 201);
		assert.deepEqual(list(dbPath), ["anyone@example.org"]);
	}, { env: { SIGNUP_ALLOWED_DOMAINS: "" } });
});

test("an allowed-but-malformed address is still malformed", async () => {
	await withServer(async ({ base, dbPath }) => {
		const response = await post(base, { email: "not-an-address@markmeijerman.eu..", elapsed: 5000 });
		assert.equal(response.status, 400);
		assert.deepEqual(await response.json(), { ok: false, error: "invalid_email" });
		assert.deepEqual(list(dbPath), []);
	}, allowOnly);
});
