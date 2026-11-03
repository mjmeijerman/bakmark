// @ts-check
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// The public origin. Astro needs it at build time for absolute URLs in the
// sitemap and the canonical tags; staging and production build the same code
// with a different value.
const site = process.env.SITE_URL ?? 'http://localhost:4321';

// https://astro.build/config
// Static pages, plus /api/subscribe which runs on the VPS (Node standalone).
export default defineConfig({
	site,
	integrations: [sitemap()],
	// 64 KiB is generous for one email address; the adapter default is 1 GiB.
	adapter: node({ mode: 'standalone', bodySizeLimit: 64 * 1024 }),
	security: {
		// Trust X-Forwarded-Host and X-Forwarded-For only from our own hosts.
		// Without this a client can spoof its IP and walk around the rate limit.
		allowedDomains: [
			{ hostname: 'bakmark.nl', protocol: 'https' },
			{ hostname: '**.bakmark.nl', protocol: 'https' },
		],
	},
});
