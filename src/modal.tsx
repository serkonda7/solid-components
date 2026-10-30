import { IconX } from '@tabler/icons-solidjs'
import type { JSX } from 'solid-js'
import { createUniqueId, onCleanup, onMount, Show } from 'solid-js'

export interface ModalProps {
	/** Whether the modal is shown. The content is mounted only while open. */
	open: boolean
	/** Called on Escape, a backdrop click or the close button; set `open` to false here. */
	onClose: () => void
	/**
	 * Called before Escape, a backdrop click or the close button call `onClose`;
	 * return `false` (or resolve to it) to keep the modal open. Further requests
	 * are ignored while a returned promise is pending.
	 */
	onBeforeClose?: () => boolean | Promise<boolean>
	/** Heading in the modal header; also its accessible name. */
	title?: JSX.Element
	/** Accessible name when there is no `title`. */
	ariaLabel?: string
	/** Id of an element describing the modal, for `aria-describedby`. */
	describedBy?: string
	/** Rendered below the body, e.g. action buttons. */
	footer?: JSX.Element
	/** Accessible name of the close button. Defaults to `Close`. */
	closeLabel?: string
	/** Hides the header close button. Escape and the backdrop still close. */
	hideCloseButton?: boolean
	/** Defaults to `true`. */
	closeOnEscape?: boolean
	/** Close on a click on the backdrop. Defaults to `true`. */
	closeOnBackdrop?: boolean
	class?: string
	children?: JSX.Element
}

/**
 * Modal dialog on top of a native `<dialog>` opened with `showModal()`: it sits
 * in the top layer and the rest of the page is inert, so focus stays inside.
 * Opening focuses the first `autofocus` element, else the first focusable one;
 * closing returns focus to the element that had it before. Controlled through
 * `open`/`onClose`.
 */
export function Modal(props: ModalProps): JSX.Element {
	return (
		<Show when={props.open}>
			<ModalDialog {...props} />
		</Show>
	)
}

function ModalDialog(props: ModalProps): JSX.Element {
	let dialog: HTMLDialogElement | undefined
	const titleId = createUniqueId()
	// Only a press that also started on the backdrop closes, so dragging a text
	// selection out of the panel doesn't.
	let pressedBackdrop = false
	let closing = false
	let confirming = false

	onMount(() => {
		if (!dialog) return
		const previous = document.activeElement
		dialog.showModal()
		onCleanup(() => {
			closing = true
			dialog?.close()
			if (previous instanceof HTMLElement && previous.isConnected) {
				previous.focus()
			}
		})
	})

	function requestClose(): void {
		if (confirming) return
		const allowed = props.onBeforeClose?.()
		if (allowed instanceof Promise) {
			confirming = true
			allowed
				.then((ok) => {
					if (ok !== false && !closing) props.onClose()
				})
				.finally(() => {
					confirming = false
				})
		} else if (allowed !== false) {
			props.onClose()
		}
	}

	function onKeyDown(e: KeyboardEvent): void {
		if (e.key !== 'Escape') return
		// Also suppresses the native cancel, so the dialog only closes through `open`.
		e.preventDefault()
		e.stopPropagation()
		if (props.closeOnEscape !== false) {
			requestClose()
		}
	}

	return (
		<dialog
			ref={dialog}
			class={props.class ? `modal ${props.class}` : 'modal'}
			aria-labelledby={props.title === undefined ? undefined : titleId}
			aria-label={props.title === undefined ? props.ariaLabel : undefined}
			aria-describedby={props.describedBy}
			onKeyDown={onKeyDown}
			// Other close requests (e.g. the Android back gesture) arrive as `cancel`.
			onCancel={(e) => {
				e.preventDefault()
				if (props.closeOnEscape !== false) {
					requestClose()
				}
			}}
			// Closed natively anyway (e.g. `<form method="dialog">`): too late to veto, report it.
			onClose={() => {
				if (!closing) props.onClose()
			}}
			onPointerDown={(e) => {
				pressedBackdrop = e.target === dialog
			}}
			onClick={(e) => {
				// The dialog has no padding, so only backdrop clicks target it directly.
				if (pressedBackdrop && e.target === dialog && props.closeOnBackdrop !== false) {
					requestClose()
				}
				pressedBackdrop = false
			}}
		>
			<div class="modal-panel">
				<Show when={props.title !== undefined || !props.hideCloseButton}>
					<div class="modal-header">
						<Show when={props.title !== undefined}>
							<h2 id={titleId} class="modal-title">
								{props.title}
							</h2>
						</Show>
						<Show when={!props.hideCloseButton}>
							<button
								type="button"
								class="modal-close"
								aria-label={props.closeLabel ?? 'Close'}
								onClick={requestClose}
							>
								<IconX size={18} aria-hidden="true" />
							</button>
						</Show>
					</div>
				</Show>
				<div class="modal-body">{props.children}</div>
				<Show when={props.footer !== undefined}>
					<div class="modal-footer">{props.footer}</div>
				</Show>
			</div>
		</dialog>
	)
}
