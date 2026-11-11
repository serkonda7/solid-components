import type { Accessor } from 'solid-js'
import { createMemo, createSignal } from 'solid-js'

/** The value of a prop that takes a value or an accessor. */
export function read<T>(value: T | Accessor<T>): T {
	return typeof value === 'function' ? (value as Accessor<T>)() : value
}

/** Joins the truthy class names. */
export function cx(...names: (string | false | undefined)[]): string {
	return names.filter(Boolean).join(' ')
}

/** Focuses `el` once it is in the document; use as a `ref`. */
export function focusOnMount(el: HTMLElement): void {
	queueMicrotask(() => el.focus())
}

/**
 * The JSON value under `key` in `localStorage`, checked by `parse`; undefined
 * when unset, corrupt, rejected by `parse`, or storage is unavailable.
 */
export function loadJson<T>(key: string | undefined, parse: (value: unknown) => T | undefined) {
	if (key === undefined) return undefined
	try {
		const raw = globalThis.localStorage?.getItem(key)
		return raw ? parse(JSON.parse(raw)) : undefined
	} catch {
		return undefined
	}
}

/** Saves `value` as JSON under `key` in `localStorage`; undefined removes the entry. */
export function saveJson(key: string | undefined, value: unknown): void {
	if (key === undefined) return
	try {
		if (value === undefined) globalThis.localStorage?.removeItem(key)
		else globalThis.localStorage?.setItem(key, JSON.stringify(value))
	} catch {
		// Storage full or unavailable (private mode): the value lasts for the session.
	}
}

export function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

/**
 * State of a user-named list of saved entries (filters, layouts): the entry
 * matching the current state, and the name typed while saving a new one.
 */
export function createSavedEntries<T extends { name: string }>(options: {
	entries: () => T[] | undefined
	/** Whether `entry` equals the current state. */
	matches: (entry: T) => boolean
	onChange: (entries: T[]) => void
}) {
	const entries = createMemo(options.entries)
	const current = createMemo(() => entries()?.find(options.matches))
	const [naming, setNaming] = createSignal(false)
	const [name, setName] = createSignal('')
	return {
		entries,
		current,
		naming,
		setNaming,
		name,
		setName,
		find: (name: string): T | undefined => entries()?.find((entry) => entry.name === name),
		/** Starts naming the current state, prefilled with its saved name. */
		startNaming(): void {
			setName(current()?.name ?? '')
			setNaming(true)
		},
		/**
		 * Emits the list with `create(name)` for the typed name, replacing an entry of
		 * the same name. Returns false, saving nothing, when the name is blank.
		 */
		save(create: (name: string) => T): boolean {
			const trimmed = name().trim()
			if (trimmed === '') return false
			const others = (entries() ?? []).filter((entry) => entry.name !== trimmed)
			options.onChange([...others, create(trimmed)])
			return true
		},
	}
}
