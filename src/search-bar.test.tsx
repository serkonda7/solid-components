import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { afterEach, expect, test } from 'vitest'
import { SearchBar } from '.'
import './styles.css'

let dispose: (() => void) | undefined
afterEach(() => {
	dispose?.()
	document.body.innerHTML = ''
})

function mount(shortcutKey?: string | false): {
	input: HTMLInputElement
	value: () => string
} {
	const container = document.createElement('div')
	document.body.append(container)
	const [value, setValue] = createSignal('')
	dispose = render(
		() => <SearchBar value={value()} onInput={setValue} shortcutKey={shortcutKey} />,
		container,
	)
	const input = container.querySelector<HTMLInputElement>('input')
	if (!input) throw new Error('No search input')
	return { input, value }
}

function press(init: KeyboardEventInit): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
	document.dispatchEvent(event)
	return event
}

function type(input: HTMLInputElement, text: string): void {
	input.value = text
	input.dispatchEvent(new InputEvent('input', { bubbles: true }))
}

test('Ctrl+K focuses the input and selects its text', () => {
	const { input } = mount()
	type(input, 'abc')
	expect(document.activeElement).not.toBe(input)
	const event = press({ key: 'k', ctrlKey: true })
	expect(event.defaultPrevented).toBe(true)
	expect(document.activeElement).toBe(input)
	expect(input.selectionStart).toBe(0)
	expect(input.selectionEnd).toBe(3)
})

test('Cmd+K works, other modifier combinations are ignored', () => {
	const { input } = mount()
	press({ key: 'k', ctrlKey: true, shiftKey: true })
	press({ key: 'k', ctrlKey: true, altKey: true })
	press({ key: 'k' })
	expect(document.activeElement).not.toBe(input)
	press({ key: 'K', metaKey: true })
	expect(document.activeElement).toBe(input)
})

test('shortcutKey changes the key and false disables the shortcut and hint', () => {
	const custom = mount('/')
	expect(document.querySelector('.search-bar-shortcut')?.textContent).toBe('Ctrl /')
	press({ key: 'k', ctrlKey: true })
	expect(document.activeElement).not.toBe(custom.input)
	press({ key: '/', ctrlKey: true })
	expect(document.activeElement).toBe(custom.input)
	dispose?.()
	document.body.innerHTML = ''

	const off = mount(false)
	expect(document.querySelector('.search-bar-shortcut')).toBeNull()
	expect(off.input.hasAttribute('aria-keyshortcuts')).toBe(false)
	press({ key: 'k', ctrlKey: true })
	expect(document.activeElement).not.toBe(off.input)
})

test('hint shows while empty and the clear button while filled', () => {
	const { input, value } = mount()
	expect(document.querySelector('.search-bar-shortcut')?.textContent).toBe('Ctrl K')
	expect(document.querySelector('.search-bar-clear')).toBeNull()

	type(input, 'abc')
	expect(value()).toBe('abc')
	expect(document.querySelector('.search-bar-shortcut')).toBeNull()
	document.querySelector<HTMLButtonElement>('.search-bar-clear')?.click()
	expect(value()).toBe('')
	expect(input.value).toBe('')
})

test('removes the global listener on dispose', () => {
	const { input } = mount()
	dispose?.()
	dispose = undefined
	const event = press({ key: 'k', ctrlKey: true })
	expect(event.defaultPrevented).toBe(false)
	expect(document.activeElement).not.toBe(input)
})
