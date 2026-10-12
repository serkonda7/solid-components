import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

const PKG = '@tabler/icons-solidjs'
const ICONS_DIR = join(
	// Resolves to dist/esm/tabler-icons-solidjs.js; package.json isn't exported.
	dirname(fileURLToPath(import.meta.resolve(PKG))),
	'../source/icons',
)
const IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*['"]@tabler\/icons-solidjs['"];?/g

/**
 * In dev, Vite resolves `@tabler/icons-solidjs` to its source barrel, which
 * loads every icon module. Rewrite named imports to the per-icon files instead.
 */
export function tablerIcons(): Plugin {
	return {
		name: 'tabler-icons-direct-imports',
		enforce: 'pre',
		transform(code, id) {
			if (id.includes('/node_modules/') || !code.includes(PKG)) return
			const out = code.replace(IMPORT_RE, (stmt, specifiers: string) => {
				const names = specifiers
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean)
				const imports = names.map((spec) => {
					const [name, local = name] = spec.split(/\s+as\s+/)
					const file = join(ICONS_DIR, `${name}.js`)
					return existsSync(file) ? `import ${local} from '${file}'` : null
				})
				// Fall back to the barrel for anything that isn't a plain icon (aliases, helpers).
				return imports.every(Boolean) ? imports.join('\n') : stmt
			})
			return out === code ? undefined : { code: out, map: null }
		},
	}
}
