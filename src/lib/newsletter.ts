/**
 * The first real mail: the double opt-in confirmation.
 *
 * One link confirms, one link unsubscribes. Nothing is sent to an address that
 * is already on the list, so a repeated signup cannot be used to mail someone
 * twice.
 */
import { randomBytes } from "node:crypto";
import { UNCONFIRMED_TTL_LABEL } from "./config";
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
			"Klopt dit niet? Doe dan niets. Zonder bevestiging sturen we je niets, en verwijderen we je e-mailadres na " +
			UNCONFIRMED_TTL_LABEL.nl +
			".",
		unsubscribe: "Uitschrijven",
		why: "Je krijgt deze mail omdat dit adres is opgegeven op bakmark.nl.",
	},
	en: {
		subject: "Confirm your newsletter subscription",
		heading: "Confirm your subscription",
		intro: "You (or someone else) entered this address for the Bakmark newsletter.",
		action: "Confirm your email address",
		ignore:
			"Not you? Do nothing. Without a confirmation we send you nothing, and we delete your email address after " +
			UNCONFIRMED_TTL_LABEL.en +
			".",
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

/** The site logo, served from the same origin the mail links to. */
const logoUrl = (): string => `${siteUrl()}/logo-bakmark.png`;

/** Text alternative if the image is blocked; some clients hide images by default. */
const LOGO_ALT = { nl: "Bakmark, naar de homepage", en: "Bakmark, to the homepage" } as const;

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
		siteUrl(),
	].join("\n");

	// Kept deliberately old-fashioned: tables, align and explicit widths are
	// what Outlook, Gmail and the rest actually honour. No flexbox, no grid,
	// no border-radius as the only shape, no <style> block. Mailpit's support
	// score reads every unsupported property against the whole audience, so a
	// single modern shorthand costs percentage points for a detail nobody sees.
	const button = { bg: "#8a3b1e", fg: "#fffdf8" };

	const html = `<!doctype html>
<html lang="${lang}">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>${escapeHtml(text.heading)}</title>
	</head>
	<body style="margin:0;padding:0;">
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f6f1e7" style="background-color:#f6f1e7;margin:0;padding:0;">
			<tr>
				<td align="center" style="padding:24px 12px;">
					<table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:520px;background-color:#fffdf8;border:1px solid #e4d9c8;">
						<tr>
							<td style="padding:24px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;">
								<a href="${escapeHtml(siteUrl())}" style="text-decoration:none;"><img src="${escapeHtml(logoUrl())}" alt="${escapeHtml(LOGO_ALT[lang])}" width="160" height="160" style="display:block;width:160px;height:auto;border:0;text-decoration:none;" /></a>
							</td>
						</tr>
						<tr>
							<td style="padding:20px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.3;font-weight:bold;color:#2a211a;">
								${escapeHtml(text.heading)}
							</td>
						</tr>
						<tr>
							<td style="padding:12px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#2a211a;">
								${escapeHtml(text.intro)}
							</td>
						</tr>
						<tr>
							<td style="padding:20px 24px 0 24px;">
								<table role="presentation" cellpadding="0" cellspacing="0" border="0">
									<tr>
										<td align="center" bgcolor="${button.bg}" style="background-color:${button.bg};mso-padding-alt:12px 20px;">
											<a href="${escapeHtml(confirmUrl)}" style="display:inline-block;padding:12px 20px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.2;font-weight:bold;color:${button.fg};text-decoration:none;">${escapeHtml(text.action)}</a>
										</td>
									</tr>
								</table>
							</td>
						</tr>
						<tr>
							<td style="padding:20px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#5c4b3c;">
								${escapeHtml(text.ignore)}
							</td>
						</tr>
						<tr>
							<td style="padding:20px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;">
								<a href="${escapeHtml(unsubscribeUrl)}" style="color:#8a3b1e;text-decoration:underline;">${escapeHtml(text.unsubscribe)}</a>
							</td>
						</tr>
						<tr>
							<td style="padding:20px 24px 24px 24px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#7a6757;">
								${escapeHtml(text.why)}
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>
	</body>
</html>`;

	await sendMail({ to: email, subject: text.subject, text: plain, html });
};
