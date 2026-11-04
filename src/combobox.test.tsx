import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { afterEach, expect, test, vi } from 'vitest'
import { Combobox, type ComboboxOption } from '.'
import './styles.css'

const options: ComboboxOption[] = [
	{ value: 1, label: 'Alpha', detail: 'First' },
	{ value: 2, label: 'Beta', detail: 'Second' },
	{ value: 3, label: 'Gamma', detail: 'Third' },
]

let dispose: (() => void) | undefined
afterEach(() => {
	dispose?.()
	document.body.innerHTML = ''
})

function mount(
	onAdd?: (query: string) => void,
	items: ComboboxOption[] = options,
	previewAtCursor?: boolean,
): {
	input: HTMLInputElement
	value: () => string
} {
	const container = document.createElement('div')
	document.body.append(container)
	const [value, setValue] = createSignal('')
	dispose = render(
		() => (
			<Combobox
				id="combo"
				value={value()}
				onChange={setValue}
				options={items}
				emptyLabel="None"
				onAdd={onAdd}
				addLabel="Add item"
				previewAtCursor={previewAtCursor}
			/>
		),
		container,
	)
	const input = container.querySelector<HTMLInputElement>('input')
	if (!input) throw new Error('No combobox input')
	return { input, value }
}

function press(input: HTMLInputElement, key: string): void {
	input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

function type(input: HTMLInputElement, text: string): void {
	input.value = text
	input.dispatchEvent(new InputEvent('input', { bubbles: true }))
}

test('arrow keys wrap around and Enter picks the active option', () => {
	const { input, value } = mount()
	press(input, 'ArrowDown')
	expect(input.getAttribute('aria-expanded')).toBe('true')
	expect(input.getAttribute('aria-activedescendant')).toBe('combo-option-0')

	press(input, 'ArrowUp')
	expect(input.getAttribute('aria-activedescendant')).toBe('combo-option-3')

	press(input, 'Enter')
	expect(value()).toBe('3')
	expect(input.getAttribute('aria-expanded')).toBe('false')
	expect(input.value).toBe('Gamma')
})

test('typing filters by label and detail; Escape closes', () => {
	const { input } = mount()
	type(input, 'second')
	const labels = [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent)
	expect(labels).toEqual(['BetaSecond'])

	type(input, 'zzz')
	expect(document.querySelector('.combobox-empty')?.textContent).toBe('No matching objects')

	press(input, 'Escape')
	expect(document.querySelector('[role="listbox"]')).toBeNull()
})

test('add entry passes the typed query to onAdd', () => {
	const onAdd = vi.fn()
	const { input, value } = mount(onAdd)
	type(input, ' Delta ')
	expect(document.querySelector('.combobox-option-add')?.textContent).toBe('Add item')

	press(input, 'Enter')
	expect(onAdd).toHaveBeenCalledWith('Delta')
	expect(value()).toBe('')
})

test('Tab picks the active option without blocking focus movement', () => {
	const { input, value } = mount()
	press(input, 'ArrowDown')
	press(input, 'ArrowDown')
	const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
	input.dispatchEvent(tab)
	expect(tab.defaultPrevented).toBe(false)
	expect(value()).toBe('1')
	expect(input.getAttribute('aria-expanded')).toBe('false')
})

test('preview follows the highlighted option while the list is open', () => {
	const { input } = mount(undefined, [
		{ value: 1, label: 'Alpha', preview: () => <span>Alpha preview</span> },
		{ value: 2, label: 'Beta' },
	])
	const preview = (): string | null | undefined =>
		document.querySelector('.combobox-preview')?.textContent
	expect(preview()).toBeUndefined()

	// Index 0 is the empty entry, which has no preview.
	press(input, 'ArrowDown')
	expect(preview()).toBeUndefined()
	press(input, 'ArrowDown')
	expect(preview()).toBe('Alpha preview')
	press(input, 'ArrowDown')
	expect(preview()).toBeUndefined()

	press(input, 'ArrowUp')
	press(input, 'Escape')
	expect(preview()).toBeUndefined()
})

test('previewAtCursor floats the preview at the mouse until the keyboard takes over', () => {
	const { input } = mount(
		undefined,
		[{ value: 1, label: 'Alpha', preview: () => <span>Alpha preview</span> }],
		true,
	)
	press(input, 'ArrowDown')
	const row = document.querySelector<HTMLElement>('[data-index="1"]')
	row?.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 40, clientY: 60 }))
	const preview = (): HTMLElement | null =>
		document.querySelector<HTMLElement>('.combobox-preview')
	expect(preview()?.classList.contains('combobox-preview-cursor')).toBe(true)
	expect(preview()?.style.getPropertyValue('--combobox-cursor-x')).toBe('40px')
	expect(preview()?.style.getPropertyValue('--combobox-cursor-y')).toBe('60px')
	expect(getComputedStyle(preview() as HTMLElement).position).toBe('fixed')

	press(input, 'ArrowUp')
	press(input, 'ArrowDown')
	expect(preview()?.classList.contains('combobox-preview-cursor')).toBe(false)
	expect(getComputedStyle(preview() as HTMLElement).position).toBe('absolute')
})
