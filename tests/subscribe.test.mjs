/**
 * The signup endpoint, over HTTP, against the built server.
 *
 * Real server, real SQLite file, real HTTP: the bugs this guards against were
 * all in the wiring between those three. Each group gets its own process and
 * its own database, because the per-IP rate limit is real and shared.
 *
 * Run `npm run build` first; `npm test` does.
 */
import assert from "node:assert/strict";
import { existsSync, unlinkSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { post, withServer } from "./helpers/server.mjs";

/** Stored addresses; an untouched or brand-new file simply has none. */
const rows = (dbPath) => {
	if (!existsSync(dbPath)) return [];
	const db = new DatabaseSync(dbPath);
	try {
		return db.prepare("select email from subscribers order by created_at").all().map((row) => row.email);
	} catch {
		return [];
	} finally {
		db.close();
	}
};

test("a valid address is stored, and a second one is not a second row", async () => {
	await withServer(async ({ base, dbPath }) => {
		const first = await post(base, { email: "Test@Example.nl ", elapsed: 5000 });
		assert.equal(first.status, 201);
		assert.deepEqual(await first.json(), { ok: true });
		assert.deepEqual(rows(dbPath), ["test@example.nl"], "the address is lowercased and trimmed");

		const again = await post(base, { email: "test@example.nl", elapsed: 5000 });
		assert.equal(again.status, 201);
		assert.deepEqual(await again.json(), { ok: true }, "a duplicate looks exactly like a new signup");
		assert.deepEqual(rows(dbPath), ["test@example.nl"]);
	});
});

test("an invalid address is refused", async () => {
	await withServer(async ({ base, dbPath }) => {
		for (const email of ["nope", "a@b..com", "a.@b.com", "a@-b.com", "a@b.c", "a@@b.com", ""]) {
			const response = await post(base, { email, elapsed: 5000 });
			assert.equal(response.status, 400, `"${email}" should be refused`);
			assert.deepEqual(await response.json(), { ok: false, error: "invalid_email" });
		}
		assert.deepEqual(rows(dbPath), []);
	});
});

test("bots are answered like everyone else and stored nowhere", async () => {
	await withServer(async ({ base, dbPath }) => {
		const cases = [
			["honeypot", { email: "bot1@example.nl", elapsed: 5000, bedrijf: "spam" }, {}],
			["too fast", { email: "bot2@example.nl", elapsed: 200 }, {}],
			["cross-origin", { email: "bot3@example.nl", elapsed: 5000 }, { origin: "https://evil.example" }],
		];

		for (const [name, body, headers] of cases) {
			const response = await post(base, body, headers);
			assert.equal(response.status, 201, `${name}: should look like a success`);
			assert.deepEqual(await response.json(), { ok: true }, `${name}: should look like a success`);
		}

		assert.deepEqual(rows(dbPath), [], "not one of the bots may be stored");
	});
});

test("the per-IP limit drops the sixth request without saying so", async () => {
	await withServer(async ({ base, dbPath }) => {
		for (let index = 1; index <= 7; index++) {
			const response = await post(base, { email: `burst${index}@example.nl`, elapsed: 5000 });
			assert.equal(response.status, 201);
			assert.deepEqual(await response.json(), { ok: true });
		}

		const stored = rows(dbPath);
		assert.equal(stored.length, 5, `expected 5 stored addresses, got ${stored.join(", ")}`);
		assert.deepEqual(stored, [1, 2, 3, 4, 5].map((n) => `burst${n}@example.nl`));
	});
});

test("a body over the cap is refused", async () => {
	await withServer(async ({ base, dbPath }) => {
		const response = await post(base, { email: "big@example.nl", elapsed: 5000, padding: "x".repeat(200_000) });
		assert.ok(response.status >= 400, `expected a refusal, got ${response.status}`);
		assert.deepEqual(rows(dbPath), []);
	});
});

test("deleting the database under a running server loses no signup", async () => {
	await withServer(async ({ base, dbPath }) => {
		assert.equal((await post(base, { email: "before@example.nl", elapsed: 5000 })).status, 201);
		assert.deepEqual(rows(dbPath), ["before@example.nl"]);

		for (const suffix of ["", "-wal", "-shm"]) {
			try {
				unlinkSync(`${dbPath}${suffix}`);
			} catch {
				/* already gone */
			}
		}

		assert.equal((await post(base, { email: "after@example.nl", elapsed: 5000 })).status, 201);
		assert.deepEqual(rows(dbPath), ["after@example.nl"], "the reopened file holds the new signup");
	});
});
