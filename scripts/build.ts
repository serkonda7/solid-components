import { rmSync } from 'node:fs'

const production = Bun.argv.includes('--prod')

// Vite empties its outDir by default; do it up front so the concurrent steps
// below don't delete files another step has already written.
rmSync('dist', { recursive: true, force: true })

const spawn = (args: string[]) =>
	Bun.spawn(['bunx', ...args], { stdio: ['inherit', 'inherit', 'inherit'] }).exited

const vite = spawn([
	'vite',
	'build',
	'--config',
	'vite.config.ts',
	'--mode',
	production ? 'production' : 'development',
])
const declaration = spawn(['tsc', '--project', 'tsconfig.build.json'])

// The Vite plugin runs in Node, so it is bundled separately from the browser entry.
const plugin = (async () => {
	const built = await Bun.build({
		entrypoints: ['./src/vite.ts'],
		outdir: './dist',
		target: 'node',
		format: 'esm',
		packages: 'external',
		minify: production,
	})
	if (built.success) return 0
	for (const log of built.logs) console.error(log)
	return 1
})()

const styles = Bun.write('./dist/styles.css', Bun.file('./src/styles.css')).then(() => 0)

// Wait for every step so no output is cut off, then report the first failure.
const codes = await Promise.all(
	[vite, declaration, plugin, styles].map((step) =>
		Promise.resolve(step).catch((error: unknown) => {
			console.error(error)
			return 1
		}),
	),
)
process.exitCode = codes.find((code) => code !== 0) ?? 0
