/**
 * Cookieless page counts, only where a collector is configured.
 *
 * Two variables, both at build time: the script URL and the website id. Without
 * both, nothing is injected, so a checkout, a staging run and a test build ship
 * no tracker at all — which is the state this site is in until someone runs the
 * stack in `analytics/`.
 *
 * Umami sets no cookies and stores no per-visitor id, so there is nothing to
 * ask consent for and no banner over the video.
 */

export interface Analytics {
	scriptUrl: string;
	websiteId: string;
}

export const analytics = (): Analytics | null => {
	const scriptUrl = process.env.UMAMI_SCRIPT_URL?.trim();
	const websiteId = process.env.UMAMI_WEBSITE_ID?.trim();
	return scriptUrl && websiteId ? { scriptUrl, websiteId } : null;
};
