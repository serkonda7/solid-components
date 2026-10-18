const production = Bun.argv.includes('--prod')

const build = Bun.spawnSync(
	[
		'bunx',
		'vite',
		'build',
		'--config',
		'vite.config.ts',
		'--mode',
		production ? 'production' : 'development',
	],
	{ stdio: ['inherit', 'inherit', 'inherit'] },
)

if (build.exitCode !== 0) process.exit(build.exitCode)

const declaration = Bun.spawnSync(['bunx', 'tsc', '--project', 'tsconfig.build.json'], {
	stdio: ['inherit', 'inherit', 'inherit'],
})

if (declaration.exitCode !== 0) process.exit(declaration.exitCode)

// The Vite plugin runs in Node, so it is bundled separately from the browser entry.
const plugin = await Bun.build({
	entrypoints: ['./src/vite.ts'],
	outdir: './dist',
	target: 'node',
	format: 'esm',
	packages: 'external',
	minify: production,
})
if (!plugin.success) {
	for (const log of plugin.logs) console.error(log)
	process.exit(1)
}

await Bun.write('./dist/styles.css', Bun.file('./src/styles.css'))

export {}
