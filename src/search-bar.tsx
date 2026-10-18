import { IconSearch, IconX } from '@tabler/icons-solidjs'
import type { JSX } from 'solid-js'
import { onCleanup, onMount, Show } from 'solid-js'

export interface SearchBarProps {
	value: string
	onInput: (value: string) => void
	/** Accessible name of the input. Defaults to `Search`. */
	ariaLabel?: string
	/** Defaults to `Search…`. */
	placeholder?: string
	/** Accessible name of the clear button. Defaults to `Clear search`. */
	clearLabel?: string
	/**
	 * Key that focuses the input together with Ctrl/Cmd, from anywhere on the page.
	 * Defaults to `k`; `false` disables the shortcut and its hint.
	 */
	shortcutKey?: string | false
	/** Text of the shortcut hint shown while empty. Defaults to `Ctrl <KEY>`. */
	shortcutLabel?: string
	class?: string
}

/**
 * Search input with a leading icon, a clear button while filled, and a global
 * Ctrl/Cmd+K shortcut that focuses and selects it. While the input is empty a
 * `<kbd>` hint shows the shortcut (hidden on touch devices).
 */
export function SearchBar(props: SearchBarProps): JSX.Element {
	let input: HTMLInputElement | undefined
	const shortcutKey = (): string | false => props.shortcutKey ?? 'k'
	const hint = (): string => props.shortcutLabel ?? `Ctrl ${String(shortcutKey()).toUpperCase()}`

	onMount(() => {
		const onKeyDown = (e: KeyboardEvent): void => {
			const key = shortcutKey()
			if (key === false || !input) return
			if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
			if (e.key.toLowerCase() !== key.toLowerCase()) return
			e.preventDefault()
			input.focus()
			input.select()
		}
		document.addEventListener('keydown', onKeyDown)
		onCleanup(() => document.removeEventListener('keydown', onKeyDown))
	})

	return (
		<div class={props.class ? `search-bar ${props.class}` : 'search-bar'}>
			<IconSearch size={17} class="search-bar-icon" aria-hidden="true" />
			<input
				ref={input}
				class="search-bar-input"
				value={props.value}
				placeholder={props.placeholder ?? 'Search…'}
				aria-label={props.ariaLabel ?? 'Search'}
				aria-keyshortcuts={
					shortcutKey() === false
						? undefined
						: `Control+${String(shortcutKey()).toUpperCase()} Meta+${String(shortcutKey()).toUpperCase()}`
				}
				onInput={(e) => props.onInput(e.currentTarget.value)}
			/>
			<Show when={!props.value && shortcutKey() !== false}>
				<kbd class="search-bar-shortcut">{hint()}</kbd>
			</Show>
			<Show when={props.value}>
				<button
					type="button"
					class="search-bar-clear"
					aria-label={props.clearLabel ?? 'Clear search'}
					onClick={() => props.onInput('')}
				>
					<IconX size={15} aria-hidden="true" />
				</button>
			</Show>
		</div>
	)
}
