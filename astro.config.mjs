// @ts-check
import node from '@astrojs/node';
import { defineConfig } from 'astro/config';

// https://astro.build/config
// Static pages, plus /api/subscribe which runs on the VPS (Node standalone).
export default defineConfig({
	adapter: node({ mode: 'standalone' }),
});
