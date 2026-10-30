import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { afterEach, expect, test, vi } from 'vitest'
import { Combobox, Modal, type ModalProps } from '.'
import './styles.css'

let dispose: (() => void) | undefined
afterEach(() => {
	dispose?.()
	document.body.innerHTML = ''
})

function mount(props: Partial<ModalProps> = { title: 'Edit' }): {
	opener: HTMLButtonElement
	setOpen: (open: boolean) => void
	onClose: ReturnType<typeof vi.fn>
	dialog: () => HTMLDialogElement | null
} {
	const container = document.createElement('div')
	document.body.append(container)
	const [open, setOpen] = createSignal(false)
	const onClose = vi.fn(() => setOpen(false))
	dispose = render(
		() => (
			<>
				<button type="button" onClick={() => setOpen(true)}>
					Open
				</button>
				<Modal {...props} open={open()} onClose={onClose}>
					<input aria-label="Name" />
					<button type="button">Save</button>
				</Modal>
			</>
		),
		container,
	)
	const opener = container.querySelector('button')
	if (!opener) throw new Error('No opener')
	return { opener, setOpen, onClose, dialog: () => document.querySelector('dialog') }
}

function openFrom(opener: HTMLButtonElement): HTMLDialogElement {
	opener.focus()
	opener.click()
	const dialog = document.querySelector('dialog')
	if (!dialog) throw new Error('No dialog')
	return dialog
}

function pressEscape(target: Element): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
	target.dispatchEvent(event)
	return event
}

test('mounts only while open, as a labelled modal dialog', () => {
	const { opener, dialog } = mount()
	expect(dialog()).toBeNull()
	const el = openFrom(opener)
	expect(el.open).toBe(true)
	expect(el.matches(':modal')).toBe(true)
	const title = el.querySelector('.modal-title')
	expect(title?.textContent).toBe('Edit')
	expect(el.getAttribute('aria-labelledby')).toBe(title?.id)
})

test('ariaLabel names the dialog without a title', () => {
	const { opener } = mount({ ariaLabel: 'Settings' })
	const el = openFrom(opener)
	expect(el.querySelector('.modal-title')).toBeNull()
	expect(el.hasAttribute('aria-labelledby')).toBe(false)
	expect(el.getAttribute('aria-label')).toBe('Settings')
})

test('focuses the first focusable element and restores focus on close', () => {
	const { opener, dialog } = mount()
	const el = openFrom(opener)
	expect(document.activeElement).toBe(el.querySelector('.modal-close'))
	el.querySelector<HTMLButtonElement>('.modal-close')?.click()
	expect(dialog()).toBeNull()
	expect(document.activeElement).toBe(opener)
})

test('autofocus element receives initial focus', () => {
	const container = document.createElement('div')
	document.body.append(container)
	dispose = render(
		() => (
			<Modal open onClose={() => {}} title="Edit">
				<input aria-label="First" />
				<input aria-label="Second" autofocus />
			</Modal>
		),
		container,
	)
	expect(document.activeElement?.getAttribute('aria-label')).toBe('Second')
})

test('the page behind is inert while open', () => {
	const { opener } = mount()
	openFrom(opener)
	opener.focus()
	expect(document.activeElement).not.toBe(opener)
})

test('Escape closes, unless closeOnEscape is false', () => {
	const { opener, onClose, dialog } = mount()
	const event = pressEscape(openFrom(opener).querySelector('input') as HTMLInputElement)
	expect(event.defaultPrevented).toBe(true)
	expect(onClose).toHaveBeenCalledTimes(1)
	expect(dialog()).toBeNull()
	dispose?.()
	document.body.innerHTML = ''

	const kept = mount({ title: 'Edit', closeOnEscape: false })
	const el = openFrom(kept.opener)
	expect(pressEscape(el).defaultPrevented).toBe(true)
	expect(kept.onClose).not.toHaveBeenCalled()
	expect(el.open).toBe(true)
})

test('Escape in an open combobox only closes its list', () => {
	const container = document.createElement('div')
	document.body.append(container)
	const onClose = vi.fn()
	dispose = render(
		() => (
			<Modal open onClose={onClose} title="Pick">
				<Combobox value="" onChange={() => {}} options={[{ value: 1, label: 'One' }]} />
			</Modal>
		),
		container,
	)
	const input = container.querySelector<HTMLInputElement>('.combobox-input')
	if (!input) throw new Error('No combobox')
	input.focus()
	input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
	expect(document.querySelector('.combobox-list')).not.toBeNull()
	pressEscape(input)
	expect(document.querySelector('.combobox-list')).toBeNull()
	expect(onClose).not.toHaveBeenCalled()
	pressEscape(input)
	expect(onClose).toHaveBeenCalledTimes(1)
})

function pointer(target: Element, type: 'pointerdown' | 'click'): void {
	const Ctor = type === 'click' ? MouseEvent : PointerEvent
	target.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true }))
}

test('a backdrop click closes, a click inside or a drag out of the panel does not', () => {
	const { opener, onClose } = mount()
	const el = openFrom(opener)
	const body = el.querySelector('.modal-body') as HTMLElement

	pointer(body, 'pointerdown')
	pointer(body, 'click')
	// A text selection dragged from the panel onto the backdrop.
	pointer(body, 'pointerdown')
	pointer(el, 'click')
	expect(onClose).not.toHaveBeenCalled()

	pointer(el, 'pointerdown')
	pointer(el, 'click')
	expect(onClose).toHaveBeenCalledTimes(1)
})

test('closeOnBackdrop false and hideCloseButton', () => {
	const { opener, onClose } = mount({ closeOnBackdrop: false, hideCloseButton: true })
	const el = openFrom(opener)
	expect(el.querySelector('.modal-close')).toBeNull()
	pointer(el, 'pointerdown')
	pointer(el, 'click')
	expect(onClose).not.toHaveBeenCalled()
})

test('closing through open does not call onClose', async () => {
	const { opener, setOpen, onClose } = mount()
	const el = openFrom(opener)
	// The native close event is dispatched asynchronously.
	const closed = new Promise((resolve) => el.addEventListener('close', resolve))
	setOpen(false)
	await closed
	expect(onClose).not.toHaveBeenCalled()
	expect(document.activeElement).toBe(opener)
})

test('a native close (form method=dialog) reports onClose', async () => {
	const container = document.createElement('div')
	document.body.append(container)
	const [open, setOpen] = createSignal(true)
	const onClose = vi.fn(() => setOpen(false))
	dispose = render(
		() => (
			<Modal open={open()} onClose={onClose} title="Confirm">
				<form method="dialog">
					<button type="submit">OK</button>
				</form>
			</Modal>
		),
		container,
	)
	document.querySelector<HTMLButtonElement>('form button')?.click()
	await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
	expect(document.querySelector('dialog')).toBeNull()
})
