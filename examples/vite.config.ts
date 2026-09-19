import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
	root: 'examples',
	server: { port: 5175 },
	plugins: [solid()],
})
