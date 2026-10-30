import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { afterEach, expect, test, vi } from 'vitest'
import { ColorInput } from '.'
import './styles.css'

let dispose: (() => void) | undefined
afterEach(() => {
	dispose?.()
	document.body.innerHTML = ''
})

function mount(initial = '#336699'): {
	text: HTMLInputElement
	picker: HTMLInputElement
	value: () => string
	setValue: (value: string) => void
	onInput: ReturnType<typeof vi.fn<(value: string) => void>>
} {
	const container = document.createElement('div')
	document.body.append(container)
	const [value, setValue] = createSignal(initial)
	const onInput = vi.fn<(value: string) => void>(setValue)
	dispose = render(() => <ColorInput value={value()} onInput={onInput} />, container)
	const text = container.querySelector<HTMLInputElement>('.color-input-text')
	const picker = container.querySelector<HTMLInputElement>('.color-input-picker')
	if (!text || !picker) throw new Error('Missing color inputs')
	return { text, picker, value, setValue, onInput }
}

function type(input: HTMLInputElement, text: string): void {
	input.focus()
	input.value = text
	input.dispatchEvent(new InputEvent('input', { bubbles: true }))
}

test('shows the value in the text input and the picker', () => {
	const { text, picker } = mount()
	expect(text.value).toBe('#336699')
	expect(picker.value).toBe('#336699')
	expect(text.getAttribute('aria-label')).toBe('Color')
	expect(picker.getAttribute('aria-label')).toBe('Pick color')
})

test('the picker updates the value and the text input', () => {
	const { text, picker, value } = mount()
	type(picker, '#ff0000')
	expect(value()).toBe('#ff0000')
	expect(text.value).toBe('#ff0000')
})

test('typing a valid hex updates the picker, normalized', () => {
	const { text, picker, value } = mount()
	type(text, 'ABCDEF')
	expect(value()).toBe('#abcdef')
	expect(picker.value).toBe('#abcdef')
	type(text, '#F00')
	expect(value()).toBe('#ff0000')
	expect(picker.value).toBe('#ff0000')
})

test('keeps typed text while focused so a shorthand can be continued', () => {
	const { text, value } = mount()
	type(text, '#abc')
	expect(value()).toBe('#aabbcc')
	expect(text.value).toBe('#abc')
	type(text, '#abcd')
	expect(value()).toBe('#aabbcc')
	type(text, '#abcdef')
	expect(value()).toBe('#abcdef')
})

test('invalid text is not emitted and reverts on blur', () => {
	const { text, onInput } = mount()
	type(text, '#12')
	expect(onInput).not.toHaveBeenCalled()
	expect(text.value).toBe('#12')
	text.blur()
	expect(text.value).toBe('#336699')
})

test('blur shows the normalized form of a shorthand', () => {
	const { text } = mount()
	type(text, '#abc')
	text.blur()
	expect(text.value).toBe('#aabbcc')
})

test('follows external value changes', () => {
	const { text, picker, setValue } = mount()
	setValue('#112233')
	expect(text.value).toBe('#112233')
	expect(picker.value).toBe('#112233')
})

test('the picker falls back to black for an invalid value, the text keeps it', () => {
	const { text, picker } = mount('')
	expect(text.value).toBe('')
	expect(picker.value).toBe('#000000')
})

test('a shorthand value is expanded for the picker', () => {
	const { picker } = mount('#f00')
	expect(picker.value).toBe('#ff0000')
})
