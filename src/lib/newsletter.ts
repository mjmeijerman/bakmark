/**
 * The first real mail: the double opt-in confirmation.
 *
 * One link confirms, one link unsubscribes. Nothing is sent to an address that
 * is already on the list, so a repeated signup cannot be used to mail someone
 * twice.
 */
import { randomBytes } from "node:crypto";
import { path, type Lang } from "./i18n";
import { sendMail } from "./mail";

/** 32 random bytes; the token is the only thing that authorises a change. */
export const newToken = (): string => randomBytes(32).toString("hex");

const siteUrl = (): string =>
	(process.env.SITE_URL?.trim() || "http://localhost:4321").replace(/\/+$/, "");

const copy = {
	nl: {
		subject: "Bevestig je inschrijving voor de nieuwsbrief",
		heading: "Bevestig je inschrijving",
		intro: "Je (of iemand anders) gaf dit adres op voor de nieuwsbrief van Bakmark.",
		action: "Bevestig je e-mailadres",
		ignore:
			"Klopt dit niet? Doe dan niets. Zonder bevestiging sturen we je niets, en het adres verdwijnt vanzelf.",
		unsubscribe: "Uitschrijven",
		why: "Je krijgt deze mail omdat dit adres is opgegeven op bakmark.nl.",
	},
	en: {
		subject: "Confirm your newsletter subscription",
		heading: "Confirm your subscription",
		intro: "You (or someone else) entered this address for the Bakmark newsletter.",
		action: "Confirm your email address",
		ignore:
			"Not you? Do nothing. Without a confirmation we send you nothing, and the address disappears on its own.",
		unsubscribe: "Unsubscribe",
		why: "You get this mail because this address was entered on bakmark.nl.",
	},
} satisfies Record<Lang, Record<string, string>>;

const escapeHtml = (value: string): string =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");

const link = (lang: Lang, route: "confirm" | "unsubscribe", token: string): string =>
	`${siteUrl()}${path(lang, route)}?token=${encodeURIComponent(token)}`;

export type Confirmation = {
	email: string;
	lang: Lang;
	confirmToken: string;
	unsubscribeToken: string;
};

export const sendConfirmation = async ({
	email,
	lang,
	confirmToken,
	unsubscribeToken,
}: Confirmation): Promise<void> => {
	const text = copy[lang];
	const confirmUrl = link(lang, "confirm", confirmToken);
	const unsubscribeUrl = link(lang, "unsubscribe", unsubscribeToken);

	const plain = [
		text.heading,
		"",
		text.intro,
		"",
		`${text.action}: ${confirmUrl}`,
		"",
		text.ignore,
		"",
		`${text.unsubscribe}: ${unsubscribeUrl}`,
		"",
		text.why,
	].join("\n");

	const html = `<!doctype html>
<html lang="${lang}">
	<body style="margin:0;padding:24px;background:#f6f1e7;color:#2a211a;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.5">
		<div style="max-width:520px;margin:0 auto;background:#fffdf8;border:1px solid #e4d9c8;border-radius:12px;padding:24px">
			<h1 style="margin:0 0 12px;font-size:22px">${escapeHtml(text.heading)}</h1>
			<p style="margin:0 0 20px">${escapeHtml(text.intro)}</p>
			<p style="margin:0 0 20px">
				<a href="${escapeHtml(confirmUrl)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#8a3b1e;color:#fffdf8;text-decoration:none;font-weight:600">${escapeHtml(text.action)}</a>
			</p>
			<p style="margin:0 0 20px;font-size:14px;color:#5c4b3c">${escapeHtml(text.ignore)}</p>
			<p style="margin:0 0 20px;font-size:14px">
				<a href="${escapeHtml(unsubscribeUrl)}" style="color:#8a3b1e">${escapeHtml(text.unsubscribe)}</a>
			</p>
			<p style="margin:0;font-size:12px;color:#7a6757">${escapeHtml(text.why)}</p>
		</div>
	</body>
</html>`;

	await sendMail({ to: email, subject: text.subject, text: plain, html });
};
