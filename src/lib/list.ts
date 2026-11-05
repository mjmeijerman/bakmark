/**
 * The subscriber list: one SQLite file next to the app.
 *
 * Everything that touches the table lives here so the signup endpoint, the
 * confirmation page and the unsubscribe page cannot drift apart. No external
 * service sees an address; the file is the whole list.
 */
import { chmodSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const DB_PATH =
	process.env.SUBSCRIBERS_DB ?? join(process.cwd(), "data", "subscribers.sqlite");

let db: DatabaseSync | undefined;
/** Identity of the file the open handle points at. */
let dbInode: number | undefined;

/*
 * SQLite keeps writing to a file that has been deleted or replaced, and every
 * write then lands in an unlinked inode: the signup is answered 201 and is
 * gone. Comparing the inode catches a replaced file, and the restart after a
 * backup restore does not silently swallow rows.
 */
const fileChanged = (): boolean => {
	try {
		const stats = statSync(DB_PATH);
		return dbInode === undefined || stats.ino !== dbInode;
	} catch {
		// Gone: reopen, which recreates the folder and the table.
		return true;
	}
};

const closeList = () => {
	try {
		db?.close();
	} catch {
		/* already gone */
	}
	db = undefined;
	dbInode = undefined;
};

/** Retries once on a stale handle: a replaced file is reopened, not written to. */
const retry = <T>(operation: () => T): T => {
	try {
		return operation();
	} catch {
		closeList();
		return operation();
	}
};

export const openList = (): DatabaseSync => {
	if (db && !fileChanged()) return db;
	if (db) closeList();

	// A list that cannot be opened is a dead form, so the failure names the path
	// instead of surfacing as a generic 500 on someone else's signup.
	try {
		mkdirSync(dirname(DB_PATH), { recursive: true, mode: 0o700 });
		db = new DatabaseSync(DB_PATH);
		dbInode = statSync(DB_PATH).ino;

		// The list is nobody else's business: 0600 on the file, 0700 on the folder.
		try {
			chmodSync(DB_PATH, 0o600);
		} catch {
			/* a read-only file system fails later and louder */
		}

		db.exec(`
			PRAGMA journal_mode = WAL;
			PRAGMA synchronous = NORMAL;
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
			CREATE INDEX IF NOT EXISTS subscribers_created_at ON subscribers (created_at);
		`);

		// A list created before double opt-in has no token columns. Adding them
		// in place keeps every stored address.
		const columns = new Set(
			(db.prepare("PRAGMA table_info(subscribers)").all() as Array<{ name: string }>).map(
				(column) => column.name,
			),
		);
		for (const [name, type] of [
			["confirm_token", "TEXT"],
			["confirm_sent_at", "TEXT"],
			["unsubscribe_token", "TEXT"],
		] as const) {
			if (!columns.has(name)) db.exec(`ALTER TABLE subscribers ADD COLUMN ${name} ${type}`);
		}

		db.exec(`
			CREATE UNIQUE INDEX IF NOT EXISTS subscribers_confirm_token
				ON subscribers (confirm_token) WHERE confirm_token IS NOT NULL;
			CREATE UNIQUE INDEX IF NOT EXISTS subscribers_unsubscribe_token
				ON subscribers (unsubscribe_token) WHERE unsubscribe_token IS NOT NULL;
		`);
	} catch (error) {
		closeList();
		throw new Error(
			`[subscribe] the list at ${DB_PATH} cannot be opened: ${(error as Error).message}`,
		);
	}

	return db;
};

export type NewSubscriber = {
	email: string;
	lang: string;
	source: string | null;
	confirmToken: string;
	unsubscribeToken: string;
};

/** True when the address was new; a duplicate is stored once and sends nothing. */
export const store = (row: NewSubscriber): boolean =>
	retry(() => {
		const now = new Date().toISOString();
		return (
			openList()
				.prepare(
					`INSERT OR IGNORE INTO subscribers
						(email, lang, source, created_at, confirm_sent_at, confirm_token, unsubscribe_token)
					 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				)
				.run(
					row.email,
					row.lang,
					row.source,
					now,
					now,
					row.confirmToken,
					row.unsubscribeToken,
				).changes > 0
		);
	});

/** Marks the row confirmed and burns the token, so a second click changes nothing. */
export const confirmByToken = (token: string): boolean => {
	if (!token) return false;
	return (
		retry(() =>
			openList()
				.prepare(
					`UPDATE subscribers SET confirmed_at = ?, confirm_token = NULL
					 WHERE confirm_token = ? AND confirmed_at IS NULL`,
				)
				.run(new Date().toISOString(), token),
		).changes > 0
	);
};

/** Removes the row outright: an unsubscribe is a deletion, not a flag. */
export const deleteByUnsubscribeToken = (token: string): boolean => {
	if (!token) return false;
	return (
		retry(() =>
			openList().prepare("DELETE FROM subscribers WHERE unsubscribe_token = ?").run(token),
		).changes > 0
	);
};

/** Undo a signup whose confirmation mail could not be sent. */
export const deleteByConfirmToken = (token: string): void => {
	retry(() =>
		openList().prepare("DELETE FROM subscribers WHERE confirm_token = ?").run(token),
	);
};

/** Rows stored since an ISO timestamp; the daily ceiling reads this. */
export const storedSince = (iso: string): number => {
	const row = retry(() =>
		openList()
			.prepare("SELECT COUNT(*) AS n FROM subscribers WHERE created_at >= ?")
			.get(iso),
	) as { n: number } | undefined;
	return row?.n ?? 0;
};

export interface Recipient {
	email: string;
	lang: string;
	unsubscribeToken: string;
}

/**
 * The people a newsletter may go to: confirmed, and able to leave.
 *
 * An unconfirmed address asked for nothing but the confirmation link, so it is
 * not on this list. A row without an unsubscribe token is skipped as well: a
 * mail nobody can unsubscribe from is not one worth sending.
 */
export const confirmedSubscribers = (): Recipient[] =>
	retry(() =>
		openList()
			.prepare(
				`SELECT email, lang, unsubscribe_token AS unsubscribeToken
				 FROM subscribers
				 WHERE confirmed_at IS NOT NULL AND unsubscribe_token IS NOT NULL
				 ORDER BY created_at`,
			)
			.all(),
	) as Recipient[];

/**
 * Deletes unconfirmed rows older than the cutoff. Returns how many went.
 *
 * An address that was never confirmed is a string someone typed, not a
 * subscriber; keeping it forever is exactly what the mail promises not to do.
 */
export const purgeUnconfirmed = (cutoffIso: string): number =>
	retry(() =>
		openList()
			.prepare("DELETE FROM subscribers WHERE confirmed_at IS NULL AND created_at < ?")
			.run(cutoffIso),
	).changes;
