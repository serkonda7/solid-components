import { IconChevronDown, IconPlus } from '@tabler/icons-solidjs'
import type { Component, JSX } from 'solid-js'
import {
	createEffect,
	createMemo,
	createSignal,
	createUniqueId,
	For,
	onMount,
	Show,
} from 'solid-js'
import { Dynamic } from 'solid-js/web'

/** Icon component rendered before an option label, e.g. one from `@tabler/icons-solidjs`. */
export type ComboboxIcon = Component<{ size?: number }>

/** One `Combobox` entry. */
export interface ComboboxOption {
	value: number | string
	label: string
	/** Secondary text (e.g. the manufacturer), shown muted in a column after the labels. */
	detail?: string
	/** Glyph shown before the label, in the list and in the closed input. */
	icon?: ComboboxIcon
}

export interface ComboboxProps {
	/** Input id, for pairing with an external `<label for>`. Generated when omitted. */
	id?: string
	/** Selected option value as a string; `''` means nothing (or the empty entry) is selected. */
	value: string
	/** Omitted on read-only comboboxes. */
	onChange?: (value: string) => void
	options: ComboboxOption[]
	/** Label of the empty (`''`) first entry; omit for no empty choice. */
	emptyLabel?: string
	required?: boolean
	disabled?: boolean
	autofocus?: boolean
	ariaLabel?: string
	describedBy?: string
	/** Called whenever the list opens, e.g. to refetch the options. */
	onOpen?: () => unknown
	/** Pins an "Add …" entry at the end of the list; receives the trimmed search text. */
	onAdd?: (query: string) => void
	/** Text of the pinned add entry. Defaults to `Add`. */
	addLabel?: string
	/** Placeholder while open and nothing is selected. Defaults to `Search`. */
	searchLabel?: string
	/** Shown when no option matches the search. Defaults to `No matching objects`. */
	noMatchesLabel?: string
	class?: string
}

/**
 * Searchable dropdown of `options`, with an optional leading empty choice.
 * A text combobox: typing filters the options by label and detail, arrow keys
 * move the highlight (wrapping around), Enter picks it, Escape closes. The
 * input shows the selected label while closed; the value sits in `data-value`.
 */
export function Combobox(props: ComboboxProps): JSX.Element {
	let input: HTMLInputElement | undefined
	let list: HTMLDivElement | undefined
	const fallbackId = createUniqueId()
	const id = (): string => props.id ?? fallbackId
	const listId = (): string => `${id()}-listbox`
	const optionId = (index: number): string => `${id()}-option-${index}`
	const [open, setOpen] = createSignal(false)
	const [query, setQuery] = createSignal('')
	const [active, setActive] = createSignal(0)

	const choices = createMemo((): ComboboxOption[] =>
		props.emptyLabel === undefined
			? props.options
			: [{ value: '', label: props.emptyLabel }, ...props.options],
	)
	const selected = createMemo(() =>
		props.value === '' ? undefined : choices().find((o) => String(o.value) === props.value),
	)
	const filtered = createMemo((): ComboboxOption[] => {
		const needle = query().trim().toLowerCase()
		return needle === ''
			? choices()
			: choices().filter(
					(o) =>
						o.label.toLowerCase().includes(needle) ||
						(o.detail?.toLowerCase().includes(needle) ?? false),
				)
	})
	const hasDetail = (): boolean => props.options.some((o) => o.detail !== undefined)
	// The add entry follows the filtered options in the arrow-key cycle.
	const addIndex = (): number => filtered().length
	const count = (): number => filtered().length + (props.onAdd ? 1 : 0)
	const editable = (): boolean => !props.disabled && props.onChange !== undefined

	onMount(() => {
		if (props.autofocus === true) {
			input?.focus()
		}
	})

	createEffect(() => {
		// Keep the highlighted option visible while arrowing through a long list.
		if (open()) {
			list?.querySelector(`[data-index="${active()}"]`)?.scrollIntoView({ block: 'nearest' })
		}
	})

	function show(): void {
		if (open() || !editable()) {
			return
		}
		setQuery('')
		const index = choices().findIndex((o) => String(o.value) === props.value)
		setActive(Math.max(index, 0))
		setOpen(true)
		void props.onOpen?.()
	}

	function pick(index: number): void {
		setOpen(false)
		if (props.onAdd && index === addIndex()) {
			props.onAdd(query().trim())
			return
		}
		const option = filtered()[index]
		if (option && String(option.value) !== props.value) {
			props.onChange?.(String(option.value))
		}
	}

	function step(delta: number): void {
		const total = count()
		if (!open()) {
			show()
		} else if (total > 0) {
			setActive((active() + delta + total) % total)
		}
	}

	function onKeyDown(e: KeyboardEvent): void {
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault()
			step(e.key === 'ArrowDown' ? 1 : -1)
			return
		}
		if (!open()) {
			return
		}
		if (e.key === 'Enter') {
			e.preventDefault()
			pick(active())
		} else if (e.key === 'Escape') {
			e.preventDefault()
			e.stopPropagation()
			setOpen(false)
		}
	}

	const placeholder = (): string | undefined =>
		open()
			? (selected()?.label ?? props.emptyLabel ?? props.searchLabel ?? 'Search')
			: props.emptyLabel

	return (
		<div
			class={props.class ? `combobox ${props.class}` : 'combobox'}
			classList={{
				'combobox-open': open(),
				'combobox-with-detail': !open() && Boolean(selected()?.detail),
				'combobox-with-icon': !open() && selected()?.icon !== undefined,
			}}
		>
			<input
				id={id()}
				ref={input}
				class="combobox-input"
				role="combobox"
				aria-expanded={open()}
				aria-controls={listId()}
				aria-autocomplete="list"
				aria-activedescendant={open() && count() > 0 ? optionId(active()) : undefined}
				aria-label={props.ariaLabel}
				aria-describedby={props.describedBy}
				autocomplete="off"
				required={props.required}
				disabled={props.disabled}
				readOnly={props.onChange === undefined}
				data-value={props.value}
				placeholder={placeholder()}
				value={open() ? query() : (selected()?.label ?? '')}
				onClick={show}
				onInput={(e) => {
					// Read first: opening resets the bound input value to the empty query.
					const text = e.currentTarget.value
					show()
					setQuery(text)
					setActive(0)
				}}
				onKeyDown={onKeyDown}
				onBlur={() => setOpen(false)}
			/>
			<Show when={!open() && selected()?.icon}>
				{(icon) => (
					<span class="combobox-icon" aria-hidden="true">
						<Dynamic component={icon()} size={14} />
					</span>
				)}
			</Show>
			<Show when={!open() && selected()?.detail}>
				<span class="combobox-value" aria-hidden="true">
					<span class="combobox-option-label">{selected()?.label}</span>
					<span class="combobox-detail">{selected()?.detail}</span>
				</span>
			</Show>
			<IconChevronDown class="combobox-chevron" size={16} aria-hidden="true" />
			<Show when={open()}>
				<div
					class="combobox-list"
					classList={{ 'combobox-list-detail': hasDetail() }}
					id={listId()}
					ref={list}
					role="listbox"
				>
					<For
						each={filtered()}
						fallback={
							<div class="combobox-empty">
								{props.noMatchesLabel ?? 'No matching objects'}
							</div>
						}
					>
						{(option, index) => (
							// biome-ignore lint/a11y/useKeyWithClickEvents: keyboard selection runs through the combobox input (aria-activedescendant)
							// biome-ignore lint/a11y/useFocusableInteractive: focus stays in the combobox input
							<div
								id={optionId(index())}
								data-index={index()}
								role="option"
								aria-selected={String(option.value) === props.value}
								classList={{
									'combobox-option': true,
									'combobox-option-active': index() === active(),
									'combobox-option-empty': option.value === '',
								}}
								// Keep focus in the input so blur doesn't close the list first.
								onMouseDown={(e) => e.preventDefault()}
								onMouseMove={() => setActive(index())}
								onClick={() => pick(index())}
							>
								<span class="combobox-option-label">
									<Show when={option.icon}>
										{(icon) => (
											<span class="combobox-option-icon" aria-hidden="true">
												<Dynamic component={icon()} size={14} />
											</span>
										)}
									</Show>
									{option.label}
								</span>
								<Show when={option.detail}>
									<span class="combobox-detail">{option.detail}</span>
								</Show>
							</div>
						)}
					</For>
					<Show when={props.onAdd}>
						{/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard selection runs through the combobox input (aria-activedescendant) */}
						{/* biome-ignore lint/a11y/useFocusableInteractive: focus stays in the combobox input */}
						<div
							id={optionId(addIndex())}
							data-index={addIndex()}
							role="option"
							aria-selected={false}
							classList={{
								'combobox-option': true,
								'combobox-option-add': true,
								'combobox-option-active': addIndex() === active(),
							}}
							onMouseDown={(e) => e.preventDefault()}
							onMouseMove={() => setActive(addIndex())}
							onClick={() => pick(addIndex())}
						>
							<IconPlus size={14} aria-hidden="true" />
							{props.addLabel ?? 'Add'}
						</div>
					</Show>
				</div>
			</Show>
		</div>
	)
}
