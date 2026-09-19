const production = Bun.argv.includes('--prod')

const build = Bun.spawnSync([
	'bunx',
	'vite',
	'build',
	'--config',
	'vite.config.ts',
	'--mode',
	production ? 'production' : 'development',
])

if (build.exitCode !== 0) process.exit(build.exitCode)

const declaration = Bun.spawnSync(['bunx', 'tsc', '--project', 'tsconfig.build.json'])

if (declaration.exitCode !== 0) process.exit(declaration.exitCode)

await Bun.write('./dist/styles.css', Bun.file('./src/styles.css'))

export {}
