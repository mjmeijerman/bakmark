/**
 * Outgoing mail.
 *
 * Development talks to a catcher (Mailpit) and never to the internet. The
 * default is `smtp://127.0.0.1:1025`; a non-loopback SMTP host is refused
 * unless MAIL_ALLOW_REMOTE=1, so a copied production .env cannot mail a real
 * person from a laptop.
 *
 * Production has no default at all: without SMTP_URL, sending throws. A
 * missing configuration must be a loud failure, not a silent second catcher.
 */
import nodemailer, { type Transporter } from "nodemailer";

const DEV_CATCHER = "smtp://127.0.0.1:1025";
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]", "mailpit"]);

export type Mail = {
	to: string;
	subject: string;
	text: string;
	html: string;
};

const inProduction = (): boolean => process.env.NODE_ENV === "production";

const smtpUrl = (): string => {
	const configured = process.env.SMTP_URL?.trim();
	if (configured) return configured;
	if (inProduction()) {
		throw new Error("[mail] SMTP_URL is not set; refusing to send");
	}
	return DEV_CATCHER;
};

const assertSafeTarget = (raw: string): void => {
	if (inProduction() || process.env.MAIL_ALLOW_REMOTE === "1") return;

	let host: string;
	try {
		host = new URL(raw).hostname;
	} catch {
		throw new Error(`[mail] SMTP_URL is not a URL: ${raw}`);
	}

	if (!LOOPBACK.has(host)) {
		throw new Error(
			`[mail] refusing to send through ${host} outside production; ` +
				"dev mail goes to the catcher, or set MAIL_ALLOW_REMOTE=1 on purpose",
		);
	}
};

let transport: { url: string; sender: Transporter } | undefined;

const sender = (): Transporter => {
	const url = smtpUrl();
	assertSafeTarget(url);

	if (!transport || transport.url !== url) {
		transport = { url, sender: nodemailer.createTransport(url) };
		if (!inProduction()) console.info(`[mail] dev mode: captured by ${url}`);
	}

	return transport.sender;
};

export const sendMail = async (mail: Mail): Promise<void> => {
	await sender().sendMail({
		from: process.env.MAIL_FROM?.trim() || "Bakmark <noreply@bakmark.nl>",
		...mail,
	});
};
