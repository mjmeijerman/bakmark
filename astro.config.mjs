// @ts-check
import node from '@astrojs/node';
import { defineConfig } from 'astro/config';

// https://astro.build/config
// Static pages, plus /api/subscribe which runs on the VPS (Node standalone).
export default defineConfig({
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
