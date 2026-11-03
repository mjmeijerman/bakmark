/**
 * The built server, over HTTP, with its own database, its own port and a
 * throwaway SMTP sink. Each group gets its own process because the per-IP
 * rate limit is real and shared.
 *
 * Run `npm run build` first; `npm test` does.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startSink } from "./smtp-sink.mjs";

const ENTRY = join(process.cwd(), "dist", "server", "entry.mjs");

const freePort = () =>
	new Promise((resolve, reject) => {
		const probe = net.createServer();
		probe.once("error", reject);
		probe.listen(0, "127.0.0.1", () => {
			const { port } = probe.address();
			probe.close(() => resolve(port));
		});
	});

export const withServer = async (run, { env = {} } = {}) => {
	assert.ok(
		existsSync(ENTRY),
		"dist/server/entry.mjs is missing — run `npm run build` before the API tests",
	);

	const smtp = await startSink();
	const dir = mkdtempSync(join(tmpdir(), "bakmark-subscribe-"));
	const dbPath = join(dir, "subscribers.sqlite");
	const port = await freePort();

	const server = spawn(process.execPath, [ENTRY], {
		env: {
			...process.env,
			NODE_ENV: "development",
			PORT: String(port),
			HOST: "127.0.0.1",
			SUBSCRIBERS_DB: dbPath,
			SMTP_URL: smtp.url,
			SITE_URL: `http://127.0.0.1:${port}`,
			...env,
		},
		stdio: "ignore",
	});

	const base = `http://127.0.0.1:${port}`;
	let up = false;
	for (let attempt = 0; attempt < 60 && !up; attempt++) {
		try {
			await fetch(`${base}/`, { signal: AbortSignal.timeout(1000) });
			up = true;
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}

	try {
		assert.ok(up, "the built server did not come up");
		await run({ base, dbPath, smtp, port });
	} finally {
		server.kill();
		await smtp.close();
		rmSync(dir, { recursive: true, force: true });
	}
};

/** JSON signup POST, the shape the form's script sends. */
export const post = (base, body, headers = {}) =>
	fetch(`${base}/api/subscribe`, {
		method: "POST",
		headers: { "content-type": "application/json", ...headers },
		body: JSON.stringify(body),
	});
