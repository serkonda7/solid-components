const production = Bun.argv.includes('--prod');

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  target: 'browser',
  format: 'esm',
  minify: production,
  sourcemap: production ? 'external' : 'inline',
  external: ['solid-js'],
});

if (!result.success) {
  for (const message of result.logs) console.error(message);
  process.exit(1);
}

const declaration = Bun.spawnSync(['bunx', 'tsc', '--project', 'tsconfig.build.json']);

if (declaration.exitCode !== 0) process.exit(declaration.exitCode);

export {};
