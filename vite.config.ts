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
			// Tabler icons are bundled (tree-shaken to the ones used), so apps need
			// neither the package nor a way to shake its barrel entry.
			external: ['solid-js', 'solid-js/web'],
		},
	},
}))
