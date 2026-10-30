import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'

export interface ColorInputProps {
	/** Hex color, `#rrggbb` or `#rgb`. */
	value: string
	/** Receives valid colors only, normalized to lowercase `#rrggbb`. */
	onInput: (value: string) => void
	/** Accessible name of the hex input. Defaults to `Color`. */
	ariaLabel?: string
	/** Accessible name of the color picker. Defaults to `Pick color`. */
	pickerLabel?: string
	disabled?: boolean
	class?: string
}

/** Lowercase `#rrggbb` form of a hex color, with or without `#`; `undefined` if invalid. */
function normalizeHex(text: string): string | undefined {
	const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim())?.[1]?.toLowerCase()
	if (!hex) return undefined
	return `#${hex.length === 3 ? hex.replace(/./g, '$&$&') : hex}`
}

/**
 * Hex text input with a native color picker swatch. Text that isn't a valid color
 * yet is kept while typing and reverts to `value` on blur.
 */
export function ColorInput(props: ColorInputProps): JSX.Element {
	const [draft, setDraft] = createSignal<string>()

	return (
		<div class={props.class ? `color-input ${props.class}` : 'color-input'}>
			<input
				type="color"
				class="color-input-picker"
				value={normalizeHex(props.value) ?? '#000000'}
				aria-label={props.pickerLabel ?? 'Pick color'}
				disabled={props.disabled}
				onInput={(e) => props.onInput(e.currentTarget.value)}
			/>
			<input
				class="color-input-text"
				value={draft() ?? props.value}
				aria-label={props.ariaLabel ?? 'Color'}
				autocomplete="off"
				spellcheck={false}
				disabled={props.disabled}
				onInput={(e) => {
					const text = e.currentTarget.value
					setDraft(text)
					const color = normalizeHex(text)
					if (color) props.onInput(color)
				}}
				onBlur={() => setDraft(undefined)}
			/>
		</div>
	)
}
