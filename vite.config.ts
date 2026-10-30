import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'
import { tablerIcons } from './src/vite.ts'

export default defineConfig(({ mode }) => ({
	plugins: [tablerIcons(), solidPlugin()],
	// TanStack's debug checks must not reach apps without a `process` global.
	define: { 'process.env.NODE_ENV': JSON.stringify(mode) },
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
