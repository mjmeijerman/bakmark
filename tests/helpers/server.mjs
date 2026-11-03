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
import http from "node:http";
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

export const withServer = async (run, { env = {}, keep = false } = {}) => {
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
		// SIGKILL: a child that ignores SIGTERM keeps the runner alive and
		// turns the whole file into "cancelled" after its timeout.
		server.kill("SIGKILL");
		// A never-awaited close leaves a pending promise that kills the run.
		await smtp.close().catch(() => {});
		// Tests that re-run a script against this database ask to keep it.
		if (!keep) rmSync(dir, { recursive: true, force: true });
	}
};

/** JSON signup POST, the shape the form's script sends. */
export const post = (base, body, headers = {}) =>
	fetch(`${base}/api/subscribe`, {
		method: "POST",
		headers: { "content-type": "application/json", ...headers },
		body: JSON.stringify(body),
	});

/**
 * A POST to `api/subscribe` that reaches `socketBase`'s real TCP socket while
 * carrying the public `Host` and `Origin` a reverse proxy (or the container's
 * 8085-to-4321 mapping) would leave behind. This is how we reproduce, in a
 * test, the situation where the Host header and the server's socket disagree
 * exactly as they do on the box; `fetch` cannot aim one host and present
 * another, so we drive the socket with `node:http`.
 */
export const postViaPublicHost = (socketBase, host, origin, body) =>
	new Promise((resolve, reject) => {
		const [hostPart, port] = socketBase.slice("http://".length).split(":");
		const req = http.request(
			{
				host: hostPart,
				port: Number(port),
				path: "/api/subscribe",
				method: "POST",
				headers: {
					"content-type": "application/json",
					host,
					...(origin ? { origin } : {}),
				},
			},
			(res) => {
				let data = "";
				res.on("data", (chunk) => (data += chunk));
				res.on("end", () =>
					resolve({
						status: res.statusCode,
						json: () => JSON.parse(data),
					}),
				);
			},
		);
		req.on("error", reject);
		req.end(JSON.stringify(body));
	});
