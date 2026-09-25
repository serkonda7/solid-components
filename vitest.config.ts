import { playwright } from '@vitest/browser-playwright'
import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	plugins: [solid()],
	test: {
		include: ['src/**/*.test.tsx'],
		// vite-plugin-solid defaults to jsdom; tests run in a real browser instead.
		environment: 'node',
		browser: {
			enabled: true,
			headless: true,
			provider: playwright(),
			instances: [{ browser: 'chromium' }],
		},
	},
})
