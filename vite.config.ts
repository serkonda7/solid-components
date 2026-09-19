import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig(({ mode }) => ({
	plugins: [solidPlugin()],
	build: {
		lib: {
			entry: './src/index.ts',
			formats: ['es'],
			fileName: 'index',
		},
		minify: mode === 'production',
		rollupOptions: {
			external: ['solid-js', 'solid-js/web'],
		},
	},
}))
