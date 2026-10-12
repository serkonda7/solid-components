import { render } from 'solid-js/web'
import { afterEach, expect, test, vi } from 'vitest'
import { type DataTableColumn, FilterTable, type FilterTableFilter } from '.'
import './styles.css'

type Row = { id: number; name: string; category: string; stock: number }

const rows: Row[] = [
	{ id: 1, name: 'Lamp', category: 'Lighting', stock: 4 },
	{ id: 2, name: 'Planter', category: 'Decor', stock: 0 },
	{ id: 3, name: 'Speaker', category: 'Audio', stock: 2 },
	{ id: 4, name: 'Spotlight', category: 'Lighting', stock: 0 },
]

const columns: DataTableColumn<Row>[] = [
	{ key: 'name', label: 'Name', getValue: (row) => row.name },
	{ key: 'category', label: 'Category', getValue: (row) => row.category },
]

const filters: FilterTableFilter<Row>[] = [
	{ key: 'name', label: 'Name', type: 'text' },
	{ key: 'category', label: 'Category', type: 'select', group: 'Attributes' },
	{ key: 'in_stock', label: 'In stock', type: 'boolean', getValue: (row) => row.stock > 0 },
]

let dispose: (() => void) | undefined
afterEach(() => {
	dispose?.()
	document.body.innerHTML = ''
})

function mount(onChange?: (values: Record<string, unknown>) => void): HTMLElement {
	const container = document.createElement('div')
	document.body.append(container)
	dispose = render(
		() => (
			<FilterTable
				rows={rows}
				columns={columns}
				filters={filters}
				getRowId={(row) => row.id}
				onFilterValuesChange={onChange}
			/>
		),
		container,
	)
	return container
}

function names(container: HTMLElement): string[] {
	return [...container.querySelectorAll('tbody tr')].map(
		(tr) => tr.children[0]?.textContent ?? '',
	)
}

function tab(container: HTMLElement, label: string): HTMLButtonElement {
	const found = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((t) =>
		t.textContent?.startsWith(label),
	)
	if (!found) throw new Error(`No tab ${label}`)
	return found
}

function type(input: HTMLInputElement, text: string): void {
	input.value = text
	input.dispatchEvent(new InputEvent('input', { bubbles: true }))
}

function press(input: HTMLInputElement, key: string): void {
	input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

function input(container: HTMLElement, label: string): HTMLInputElement {
	const found = [...container.querySelectorAll('label')].find((l) => l.textContent === label)
	const control = found && container.querySelector<HTMLInputElement>(`[id="${found.htmlFor}"]`)
	if (!control) throw new Error(`No input for ${label}`)
	return control
}

test('quick search filters rows and updates the results badge', () => {
	const onChange = vi.fn()
	const container = mount(onChange)
	const search = container.querySelector<HTMLInputElement>('input[type="search"]')
	if (!search) throw new Error('No quick search')

	type(search, 'sp')
	expect(names(container)).toEqual(['Speaker', 'Spotlight'])
	expect(tab(container, 'Results').textContent).toBe('Results2')
	expect(onChange).toHaveBeenLastCalledWith({ q: 'sp' })
})

test('filter form applies on submit and pills remove filters', () => {
	const container = mount()
	tab(container, 'Filters').click()
	expect(tab(container, 'Filters').getAttribute('aria-selected')).toBe('true')

	const category = input(container, 'Category')
	type(category, 'light')
	press(category, 'Enter')
	const stock = input(container, 'In stock')
	type(stock, 'yes')
	press(stock, 'Enter')
	// Nothing applies until the form is submitted.
	expect(names(container)).toHaveLength(4)

	container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click()
	expect(tab(container, 'Results').getAttribute('aria-selected')).toBe('true')
	expect(names(container)).toEqual(['Lamp'])
	expect(tab(container, 'Filters').textContent).toBe('Filters2')

	const pills = [...container.querySelectorAll<HTMLButtonElement>('.filter-table-pill')]
	expect(pills.map((p) => p.textContent)).toEqual([
		'Category: Lighting',
		'In stock: Yes',
		'Clear all',
	])

	pills[1]?.click()
	expect(names(container)).toEqual(['Lamp', 'Spotlight'])

	container.querySelector<HTMLButtonElement>('.filter-table-pill-clear')?.click()
	expect(names(container)).toHaveLength(4)
	expect(container.querySelector('.filter-table-pills')).toBeNull()
})
