import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { tablerIcons } from '../scripts/vite-tabler-icons.ts'

export default defineConfig({
	root: 'examples',
	server: { port: 5175 },
	plugins: [tablerIcons(), solid()],
})
