import { IconChevronDown, IconPlus, IconX } from '@tabler/icons-solidjs'
import type { Component, JSX } from 'solid-js'
import {
	createEffect,
	createMemo,
	createSignal,
	createUniqueId,
	For,
	onMount,
	Show,
	splitProps,
} from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { cx } from './utils'

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
	/** Rendered in a panel beside the open list while this option is highlighted. */
	preview?: Component
}

/** Props shared by `Combobox` and `MultiCombobox`. */
export interface ComboboxBaseProps {
	/** Input id, for pairing with an external `<label for>`. Generated when omitted. */
	id?: string
	options: ComboboxOption[]
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
	/** Placeholder while closed and nothing is selected; `emptyLabel` takes precedence. */
	placeholder?: string
	/** Placeholder while open and nothing is selected. Defaults to `Search`. */
	searchLabel?: string
	/** Shown when no option matches the search. Defaults to `No matching objects`. */
	noMatchesLabel?: string
	/**
	 * Float option previews at the mouse cursor while the pointer moves over the
	 * list. Keyboard navigation returns them to their place beside the list.
	 */
	previewAtCursor?: boolean
	class?: string
}

export interface ComboboxProps extends ComboboxBaseProps {
	/** Selected option value as a string; `''` means nothing (or the empty entry) is selected. */
	value: string
	/** Omitted on read-only comboboxes. */
	onChange?: (value: string) => void
	/** Label of the empty (`''`) first entry; omit for no empty choice. */
	emptyLabel?: string
}

export interface MultiComboboxProps extends ComboboxBaseProps {
	/** Selected option values as strings, in the order they were picked. */
	values: string[]
	/** Omitted on read-only comboboxes. */
	onChange?: (values: string[]) => void
	/** Accessible name of a chip's remove button. Defaults to `Remove <label>`. */
	removeLabel?: (label: string) => string
}

/** Internal props: single mode passes `value`, multi mode `multiple` and `values`. */
interface ComboboxCoreProps extends ComboboxBaseProps {
	multiple?: boolean
	value: string
	values?: string[]
	/** Single mode: the new value. Multi mode: the value to add. */
	onChange?: (value: string) => void
	onRemove?: (value: string) => void
	emptyLabel?: string
	removeLabel?: (label: string) => string
}

/**
 * Searchable dropdown of `options`, with an optional leading empty choice.
 * A text combobox: typing filters the options by label and detail, arrow keys
 * move the highlight (wrapping around), Enter picks it, Tab picks it and moves
 * focus on, Escape closes. The input shows the selected label while closed;
 * the value sits in `data-value`.
 */
export function Combobox(props: ComboboxProps): JSX.Element {
	return ComboboxCore(props)
}

/**
 * Searchable multi-select: the picked options show as removable chips inside
 * the control, in front of the search input. Picking keeps the list open for
 * the next choice and leaves picked options out of it; Backspace in the empty
 * input removes the last chip. Keys otherwise work as in `Combobox`, except
 * that Tab only closes the list.
 */
export function MultiCombobox(props: MultiComboboxProps): JSX.Element {
	const [local, rest] = splitProps(props, ['values', 'onChange'])
	return (
		<ComboboxCore
			{...rest}
			multiple
			value=""
			values={local.values}
			onChange={
				local.onChange ? (value) => local.onChange?.([...local.values, value]) : undefined
			}
			onRemove={(value) => local.onChange?.(local.values.filter((v) => v !== value))}
		/>
	)
}

function ComboboxCore(props: ComboboxCoreProps): JSX.Element {
	// Fixed per instance: the two modes render different markup.
	const multiple = props.multiple === true
	let input: HTMLInputElement | undefined
	let list: HTMLDivElement | undefined
	const fallbackId = createUniqueId()
	const id = (): string => props.id ?? fallbackId
	const listId = (): string => `${id()}-listbox`
	const optionId = (index: number): string => `${id()}-option-${index}`
	const [open, setOpen] = createSignal(false)
	const [query, setQuery] = createSignal('')
	const [active, setActive] = createSignal(0)
	// Last pointer position over the list; cleared by keyboard navigation.
	const [cursor, setCursor] = createSignal<{ x: number; y: number }>()

	const values = (): string[] => props.values ?? []
	const choices = createMemo((): ComboboxOption[] => {
		if (multiple) {
			return props.options.filter((o) => !values().includes(String(o.value)))
		}
		return props.emptyLabel === undefined
			? props.options
			: [{ value: '', label: props.emptyLabel }, ...props.options]
	})
	const selected = createMemo(() =>
		multiple || props.value === ''
			? undefined
			: choices().find((o) => String(o.value) === props.value),
	)
	const optionOf = (value: string): ComboboxOption | undefined =>
		props.options.find((o) => String(o.value) === value)
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
	// The add entry has no option, so it never has a preview.
	const activePreview = (): Component | undefined => filtered()[active()]?.preview

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
		setCursor(undefined)
		setOpen(true)
		void props.onOpen?.()
	}

	function pick(index: number): void {
		if (props.onAdd && index === addIndex()) {
			setOpen(false)
			props.onAdd(query().trim())
			return
		}
		const option = filtered()[index]
		if (multiple) {
			// Stay open for the next pick; the picked option leaves the list.
			if (option) {
				setQuery('')
				props.onChange?.(String(option.value))
				setActive(Math.min(index, Math.max(count() - 1, 0)))
			}
			return
		}
		setOpen(false)
		if (option && String(option.value) !== props.value) {
			props.onChange?.(String(option.value))
		}
	}

	function remove(value: string): void {
		props.onRemove?.(value)
		setActive((current) => Math.min(current, Math.max(count() - 1, 0)))
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
		if (multiple && e.key === 'Backspace' && editable() && query() === '') {
			const last = values().at(-1)
			if (last !== undefined) {
				e.preventDefault()
				remove(last)
			}
			return
		}
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault()
			setCursor(undefined)
			step(e.key === 'ArrowDown' ? 1 : -1)
			return
		}
		if (!open()) {
			return
		}
		if (e.key === 'Enter') {
			e.preventDefault()
			pick(active())
		} else if (e.key === 'Tab') {
			// Like Enter, but focus moves on to the next field. The add entry
			// navigates away, so Tab just closes the list there. A multi-select
			// stays open after picks, so Tab only closes it.
			if (multiple || (props.onAdd && active() === addIndex())) {
				setOpen(false)
			} else {
				pick(active())
			}
		} else if (e.key === 'Escape') {
			e.preventDefault()
			e.stopPropagation()
			setOpen(false)
		}
	}

	const placeholder = (): string | undefined => {
		if (multiple) {
			if (values().length > 0) return undefined
			return open() ? (props.searchLabel ?? 'Search') : props.placeholder
		}
		return open()
			? (selected()?.label ?? props.emptyLabel ?? props.searchLabel ?? 'Search')
			: (props.emptyLabel ?? props.placeholder)
	}

	function optionRow(option: ComboboxOption, index: () => number): JSX.Element {
		return (
			// biome-ignore lint/a11y/useKeyWithClickEvents: keyboard selection runs through the combobox input (aria-activedescendant)
			// biome-ignore lint/a11y/useFocusableInteractive: focus stays in the combobox input
			<div
				id={optionId(index())}
				data-index={index()}
				role="option"
				aria-selected={!multiple && String(option.value) === props.value}
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
		)
	}

	function addRow(): JSX.Element {
		return (
			// biome-ignore lint/a11y/useKeyWithClickEvents: keyboard selection runs through the combobox input (aria-activedescendant)
			// biome-ignore lint/a11y/useFocusableInteractive: focus stays in the combobox input
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
		)
	}

	const field = (
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
			// The chips, not the search text, satisfy a required multi-select.
			required={props.required && (!multiple || values().length === 0)}
			disabled={props.disabled}
			readOnly={props.onChange === undefined}
			data-value={multiple ? undefined : props.value}
			placeholder={placeholder()}
			value={open() ? query() : multiple ? '' : (selected()?.label ?? '')}
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
	)

	function chip(value: string): JSX.Element {
		const label = (): string => optionOf(value)?.label ?? value
		return (
			<li class="combobox-chip">
				<Show when={optionOf(value)?.icon}>
					{(icon) => (
						<span class="combobox-chip-icon" aria-hidden="true">
							<Dynamic component={icon()} size={12} />
						</span>
					)}
				</Show>
				{label()}
				<Show when={editable()}>
					<button
						type="button"
						class="combobox-chip-remove"
						aria-label={props.removeLabel?.(label()) ?? `Remove ${label()}`}
						// Keep focus (and an open list) where it is.
						onMouseDown={(e) => e.preventDefault()}
						onClick={(e) => {
							e.stopPropagation()
							remove(value)
						}}
					>
						<IconX size={12} aria-hidden="true" />
					</button>
				</Show>
			</li>
		)
	}

	/** Multi mode: chips and the search input share one bordered box. */
	function control(): JSX.Element {
		return (
			// biome-ignore lint/a11y/useKeyWithClickEvents: the input inside handles the keyboard
			// biome-ignore lint/a11y/noStaticElementInteractions: forwards clicks on chips and padding to the input
			<div
				class="combobox-control"
				classList={{ 'combobox-control-disabled': props.disabled === true }}
				// Outside the input, keep focus where it is instead of blurring it.
				onMouseDown={(e) => {
					if (e.target !== input) e.preventDefault()
				}}
				onClick={() => {
					input?.focus()
					show()
				}}
			>
				<Show when={values().length > 0}>
					<ul class="combobox-chips">
						<For each={values()}>{chip}</For>
					</ul>
				</Show>
				{field}
			</div>
		)
	}

	const cursorPreview = (): { x: number; y: number } | undefined =>
		props.previewAtCursor === true ? cursor() : undefined

	function listbox(): JSX.Element {
		return (
			<div
				class="combobox-list"
				classList={{ 'combobox-list-detail': hasDetail() }}
				id={listId()}
				ref={list}
				role="listbox"
				onMouseMove={(e) => {
					if (props.previewAtCursor === true) {
						setCursor({ x: e.clientX, y: e.clientY })
					}
				}}
			>
				<For
					each={filtered()}
					fallback={
						<div class="combobox-empty">
							{props.noMatchesLabel ?? 'No matching objects'}
						</div>
					}
				>
					{optionRow}
				</For>
				<Show when={props.onAdd}>{addRow()}</Show>
			</div>
		)
	}

	return (
		<div
			// `multiple` never changes, so it goes in `class`: a reactive `class`
			// would wipe a static `classList` entry.
			class={cx('combobox', multiple && 'combobox-multiple', props.class)}
			classList={{
				'combobox-open': open(),
				'combobox-with-detail': !open() && Boolean(selected()?.detail),
				'combobox-with-icon': !open() && selected()?.icon !== undefined,
			}}
		>
			{multiple ? control() : field}
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
			<Show when={open()}>{listbox()}</Show>
			<Show when={open() && activePreview()}>
				{(preview) => (
					<div
						class="combobox-preview"
						classList={{ 'combobox-preview-cursor': cursorPreview() !== undefined }}
						style={
							cursorPreview()
								? {
										'--combobox-cursor-x': `${cursorPreview()?.x}px`,
										'--combobox-cursor-y': `${cursorPreview()?.y}px`,
									}
								: undefined
						}
						aria-hidden="true"
					>
						<Dynamic component={preview()} />
					</div>
				)}
			</Show>
		</div>
	)
}
