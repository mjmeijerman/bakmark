/**
 * The first real mail: the double opt-in confirmation.
 *
 * One link confirms, one link unsubscribes. Nothing is sent to an address that
 * is already on the list, so a repeated signup cannot be used to mail someone
 * twice.
 */
import { randomBytes } from "node:crypto";
import { UNCONFIRMED_TTL_LABEL } from "./config.ts";
import { path, type Lang } from "./i18n.ts";
import type { Recipient } from "./list.ts";
import { sendMail } from "./mail.ts";
import type { ReportVideo } from "./videos.ts";

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

/* ------------------------------------------------------------------------- */
/* The weekly newsletter: the videos published since the last one.            */
/* ------------------------------------------------------------------------- */

/**
 * The mail that goes to the list.
 *
 * It links to the recipe page, never to YouTube: the video is embedded there,
 * with the timings and the print view around it, and a watch link would send
 * the reader straight past all of that.
 *
 * `preview` keeps the layout but says what it is and shows the status of a
 * recipe that is not live yet, so the mail can be looked at before anything is
 * published.
 */
const weeklyCopy = {
	nl: {
		one: (title: string) => `Nieuwe video op Bakmark: ${title}`,
		many: (count: number) => `Nieuwe video's op Bakmark (${count})`,
		introOne: "Er staat één nieuwe video op Bakmark.",
		introMany: (count: number) => `Er staan ${count} nieuwe video's op Bakmark.`,
		action: "Bekijk het recept",
		browse: "Alle recepten",
		why: "Je krijgt deze mail omdat je je hebt aangemeld voor de nieuwsbrief van Bakmark.",
		unsubscribe: "Uitschrijven",
		previewIntro: (count: number) =>
			`Testmail met alle ${count} recepten die een video hebben, ook de concepten.`,
		previewSubject: (count: number) => `Testmail: alle ${count} recepten met een video`,
		previewWhy: "Testmail, met de hand verstuurd. Telt niet mee voor de nieuwsbrief van volgende week.",
	},
	en: {
		one: (title: string) => `New video on Bakmark: ${title}`,
		many: (count: number) => `New videos on Bakmark (${count})`,
		introOne: "There is one new video on Bakmark.",
		introMany: (count: number) => `There are ${count} new videos on Bakmark.`,
		action: "Open the recipe",
		browse: "All recipes",
		why: "You get this mail because you signed up for the Bakmark newsletter.",
		unsubscribe: "Unsubscribe",
		previewIntro: (count: number) =>
			`Test mail with all ${count} recipes that have a video, drafts included.`,
		previewSubject: (count: number) => `Test mail: all ${count} recipes with a video`,
		previewWhy: "Test mail, sent by hand. It does not count towards next week's newsletter.",
	},
} satisfies Record<Lang, Record<string, unknown>>;

export interface WeeklyMail {
	subject: string;
	text: string;
	html: string;
}

export const weeklyMail = ({
	videos,
	lang,
	siteUrl: base,
	unsubscribeUrl,
	preview = false,
}: {
	videos: ReportVideo[];
	lang: Lang;
	siteUrl: string;
	unsubscribeUrl?: string;
	preview?: boolean;
}): WeeklyMail => {
	const text = weeklyCopy[lang];
	const count = videos.length;

	if (count === 0) throw new Error("[newsletter] nothing to send; do not build an empty mail");

	const subject = preview
		? text.previewSubject(count)
		: count === 1
			? text.one(videos[0].title)
			: text.many(count);

	const intro = preview
		? text.previewIntro(count)
		: count === 1
			? text.introOne
			: text.introMany(count);

	const recipeUrl = (video: ReportVideo) => `${base}${path(lang, "recipe", video.slug)}`;

	const plain = [intro, ""];
	videos.forEach((video, index) => {
		const status = preview && video.status !== "gepubliceerd" ? ` (${video.status})` : "";
		plain.push(`${index + 1}. ${video.title}${status}`);
		plain.push(`   ${recipeUrl(video)}`);
		plain.push("");
	});
	plain.push(`${text.browse}: ${base}${path(lang, "recipes")}`);
	plain.push("");
	plain.push(preview ? text.previewWhy : text.why);
	if (unsubscribeUrl) plain.push(`${text.unsubscribe}: ${unsubscribeUrl}`);

	const rows = videos
		.map((video) => {
			const url = recipeUrl(video);
			const status =
				preview && video.status !== "gepubliceerd"
					? ` <span style="color:#7a6757;font-weight:normal;">(${escapeHtml(video.status)})</span>`
					: "";
			return `<tr>
									<td style="padding:0 0 2px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.35;font-weight:bold;color:#2a211a;">
										<a href="${escapeHtml(url)}" style="color:#2a211a;text-decoration:none;">${escapeHtml(video.title)}</a>${status}
									</td>
								</tr>
								<tr>
									<td style="padding:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;">
										<a href="${escapeHtml(url)}" style="color:#8a3b1e;text-decoration:underline;">${escapeHtml(text.action)}</a>
									</td>
								</tr>`;
		})
		.join("\n\t\t\t\t\t\t\t\t");

	const unsubscribeRow = unsubscribeUrl
		? `<tr>
							<td style="padding:8px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;">
								<a href="${escapeHtml(unsubscribeUrl)}" style="color:#8a3b1e;text-decoration:underline;">${escapeHtml(text.unsubscribe)}</a>
							</td>
						</tr>`
		: "";

	const html = `<!doctype html>
<html lang="${lang}">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>${escapeHtml(subject)}</title>
	</head>
	<body style="margin:0;padding:0;">
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f6f1e7" style="background-color:#f6f1e7;margin:0;padding:0;">
			<tr>
				<td align="center" style="padding:24px 12px;">
					<table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:520px;background-color:#fffdf8;border:1px solid #e4d9c8;">
						<tr>
							<td style="padding:24px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;">
								<a href="${escapeHtml(base)}" style="text-decoration:none;"><img src="${escapeHtml(logoUrl())}" alt="${escapeHtml(LOGO_ALT[lang])}" width="120" height="120" style="display:block;width:120px;height:auto;border:0;text-decoration:none;" /></a>
							</td>
						</tr>
						<tr>
							<td style="padding:20px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.3;font-weight:bold;color:#2a211a;">
								${escapeHtml(intro)}
							</td>
						</tr>
						<tr>
							<td style="padding:20px 24px 8px 24px;">
								<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
								${rows}
								</table>
							</td>
						</tr>
						<tr>
							<td style="padding:4px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;">
								<a href="${escapeHtml(base + path(lang, "recipes"))}" style="color:#8a3b1e;text-decoration:underline;">${escapeHtml(text.browse)}</a>
							</td>
						</tr>
						${unsubscribeRow}
						<tr>
							<td style="padding:20px 24px 24px 24px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#7a6757;">
								${escapeHtml(preview ? text.previewWhy : text.why)}
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>
	</body>
</html>`;

	return { subject, text: plain.join("\n"), html };
};

export interface WeeklyResult {
	sent: number;
	failed: string[];
	/** True when there was nobody to send to; nothing was attempted. */
	empty: boolean;
}

/**
 * One mail per subscriber, in their own language, with their own unsubscribe
 * link. Not a bcc: a shared recipient header tells every reader who else is on
 * the list, and one unsubscribe link cannot serve all of them.
 */
export const sendWeekly = async ({
	videos,
	siteUrl: base,
	recipients,
	preview = false,
}: {
	videos: ReportVideo[];
	siteUrl: string;
	recipients: Recipient[];
	preview?: boolean;
}): Promise<WeeklyResult> => {
	const failed: string[] = [];
	let sent = 0;

	for (const recipient of recipients) {
		const lang: Lang = recipient.lang === "en" ? "en" : "nl";
		// No token, no unsubscribe link: a preview has no row to remove.
		const unsubscribeUrl = recipient.unsubscribeToken
			? `${base}${path(lang, "unsubscribe")}?token=${encodeURIComponent(recipient.unsubscribeToken)}`
			: undefined;
		const mail = weeklyMail({ videos, lang, siteUrl: base, unsubscribeUrl, preview });

		try {
			await sendMail({
				to: recipient.email,
				subject: mail.subject,
				text: mail.text,
				html: mail.html,
				// The header Gmail and Yahoo want from a list. No -Post header:
				// that promises a POST endpoint, and the route is a GET link.
				...(unsubscribeUrl ? { headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` } } : {}),
			});
			sent += 1;
		} catch (error) {
			// One refused recipient must not stop the rest of the list.
			failed.push(recipient.email);
			console.error(`[newsletter] could not mail ${recipient.email}: ${(error as Error).message}`);
		}
	}

	return { sent, failed, empty: recipients.length === 0 };
};
