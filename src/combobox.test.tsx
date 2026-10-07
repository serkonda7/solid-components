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

function mount(onAdd?: (query: string) => void): {
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
				options={options}
				emptyLabel="None"
				onAdd={onAdd}
				addLabel="Add item"
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
