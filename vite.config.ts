import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'
import { tablerIcons } from './src/vite.ts'

export default defineConfig(({ mode }) => ({
	plugins: [tablerIcons(), solidPlugin()],
	build: {
		lib: {
			entry: './src/index.ts',
			formats: ['es'],
			fileName: 'index',
		},
		minify: mode === 'production',
		rollupOptions: {
			// Tabler icons are bundled (tree-shaken to the ones used), so apps need
			// neither the package nor a way to shake its barrel entry. TanStack stays
			// external so apps using it directly share one copy.
			external: ['solid-js', 'solid-js/web', '@tanstack/solid-table'],
		},
	},
}))
