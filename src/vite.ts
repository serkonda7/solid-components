import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

const PKG = '@tabler/icons-solidjs'
const PKG_SEGMENT = `/${PKG}/`
const NAMED_IMPORT_RE = /import\s+(type\s+)?\{([^}]*)\}\s*from\s*(['"])@tabler\/icons-solidjs\3;?/g
/** Any import/export of the package root that is left after the rewrite. */
const LEFTOVER_RE =
	/(?:\bfrom\s*|\bimport\s*\(?\s*)(['"])@tabler\/icons-solidjs\1|\brequire\s*\(\s*(['"])@tabler\/icons-solidjs\2/
const ICON_NAME_RE = /^Icon[A-Za-z0-9]+$/
const SCRIPT_RE = /\.[cm]?[jt]sx?$/

/**
 * Keeps `@tabler/icons-solidjs` from loading its barrel, which re-exports ~6000
 * icon modules. `vite-plugin-solid` adds the `solid` export condition, so in dev
 * the barrel is unbundled source and the browser fetches every one of them.
 *
 * - Rewrites `import { IconX, IconY as Y } from '@tabler/icons-solidjs'` to
 *   per-icon default imports, in dev and build. `type` specifiers are dropped.
 * - Fails the transform for anything it can't rewrite (namespace, default, or
 *   dynamic imports, re-exports, unknown names) instead of falling back.
 * - In dev, resolving the package root from any other module is an error that
 *   names the importer, and the package is excluded from dependency pre-bundling.
 *
 * Add it before `solid()`: `plugins: [tablerIcons(), solid()]`.
 */
export function tablerIcons(): Plugin {
	let serve = false
	/** Icons directory per resolved package root, so each importer uses its own install. */
	const iconDirs = new Map<string, string>()

	return {
		name: 'solid-components:tabler-icons',
		enforce: 'pre',
		config(_, env) {
			serve = env.command === 'serve'
			return { optimizeDeps: { exclude: [PKG] } }
		},
		async resolveId(source, importer, options) {
			if (!serve || source !== PKG || (options as { scan?: boolean }).scan) return null
			this.error(
				`${importer ?? 'unknown module'} imports the ${PKG} barrel, which loads every icon. ` +
					`Use plain named imports (import { IconX } from '${PKG}') in a file transformed by tablerIcons().`,
			)
		},
		async transform(code, id) {
			if (!code.includes(PKG) || id.startsWith('\0') || id.includes(PKG_SEGMENT)) return
			const file = id.split('?', 1)[0] ?? id
			if (!SCRIPT_RE.test(file)) return

			const resolved = await this.resolve(PKG, file, { skipSelf: true })
			if (!resolved) this.error(`Cannot resolve ${PKG} from ${file}`)
			const pkgRoot = resolved.id.slice(
				0,
				resolved.id.lastIndexOf(PKG_SEGMENT) + PKG_SEGMENT.length,
			)
			let iconDir = iconDirs.get(pkgRoot)
			if (!iconDir) {
				iconDir = join(pkgRoot, 'dist/source/icons')
				if (!existsSync(iconDir)) this.error(`${PKG} has no per-icon modules at ${iconDir}`)
				iconDirs.set(pkgRoot, iconDir)
			}
			const dir = iconDir

			const out = code.replace(
				NAMED_IMPORT_RE,
				(_stmt, typeOnly: string | undefined, specs: string) => {
					if (typeOnly) return ''
					return specs
						.split(',')
						.map((spec) => spec.trim())
						.filter((spec) => spec !== '' && !spec.startsWith('type '))
						.map((spec) => {
							const [name = '', local = name] = spec.split(/\s+as\s+/)
							const iconFile = join(dir, `${name}.js`)
							if (!ICON_NAME_RE.test(name) || !existsSync(iconFile)) {
								this.error(`${file}: '${name}' is not a ${PKG} icon`)
							}
							return `import ${local} from ${JSON.stringify(iconFile)};`
						})
						.join('\n')
				},
			)
			if (LEFTOVER_RE.test(out)) {
				this.error(
					`${file}: only plain named imports from ${PKG} are supported ` +
						`(no namespace, default, or dynamic imports, or re-exports)`,
				)
			}
			return out === code ? undefined : { code: out, map: null }
		},
	}
}
