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
import { post, postViaPublicHost, withServer } from "./helpers/server.mjs";

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

// The signup that must not be dropped: one that crossed a port mapping. Behind
// the container's 8085->4321 forward (or Caddy on the VPS) the browser sends
// Origin: localhost:8085 while the server's socket sits on 4321. Comparing
// Origin to request.url (the socket) always reads as cross-origin and dropped
// every real signup with a silent 201. The check compares Origin to the Host
// header instead, so it must pass here — that is the regression the fix adds.
test("a same-origin signup that crossed a port mapping is not dropped", async () => {
	await withServer(async ({ base, dbPath, smtp }) => {
		const socket = base.slice("http://".length); // 127.0.0.1:<port>, the real TCP target
		const publicHost = "localhost:8085"; // the origin the browser saw

		// Host (request target) and Origin (sending page) agree, as a real
		// same-origin form does — even though both differ from the socket.
		const response = await postViaPublicHost(base, publicHost, `http://${publicHost}`, {
			email: "mapped@example.nl",
			elapsed: 5000,
		});
		assert.equal(response.status, 201);
		assert.deepEqual(await response.json(), { ok: true });
		assert.deepEqual(rows(dbPath), ["mapped@example.nl"], "the real signup was stored");
		assert.equal(smtp.messages.length, 1, "its confirmation mail went out");
	});
});

test("a genuinely cross-origin signup is still dropped", async () => {
	await withServer(async ({ base, dbPath, smtp }) => {
		// A page on another origin POSTing here: Origin (sender) disagrees with
		// the Host (target), which is what a cross-origin request looks like.
		const response = await postViaPublicHost(base, "localhost:8085", "http://evil.example:8085", {
			email: "evil@example.nl",
			elapsed: 5000,
		});
		assert.equal(response.status, 201, "a bot still sees a success, not a refusal");
		assert.deepEqual(rows(dbPath), [], "the cross-origin signup was not stored");
		assert.equal(smtp.messages.length, 0);
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
