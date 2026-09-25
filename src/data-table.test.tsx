import { render } from 'solid-js/web'
import { afterEach, expect, test } from 'vitest'
import { DataTable, type DataTableColumn } from '.'
import './styles.css'

type Row = { id: number; name: string; price: number }

const rows: Row[] = [
	{ id: 1, name: 'B', price: 2 },
	{ id: 2, name: 'A', price: 10 },
	{ id: 3, name: 'C', price: 1 },
]

// Short cell values keep the header content the widest part of each column.
const columns: DataTableColumn<Row>[] = [
	{ key: 'name', label: 'Name', sortable: true, getValue: (row) => row.name },
	{ key: 'price', label: 'Price', sortable: true, getValue: (row) => row.price },
	{ key: 'id', label: 'ID', getValue: (row) => row.id },
]

let dispose: (() => void) | undefined
afterEach(() => {
	dispose?.()
	document.body.innerHTML = ''
})

function mount(): HTMLElement {
	const container = document.createElement('div')
	container.style.width = '600px'
	document.body.append(container)
	dispose = render(
		() => <DataTable rows={rows} columns={columns} getRowId={(row) => row.id} />,
		container,
	)
	return container
}

function columnWidths(container: HTMLElement): number[] {
	return [...container.querySelectorAll('thead th')].map((th) => th.getBoundingClientRect().width)
}

function sortButton(container: HTMLElement, label: string): HTMLButtonElement {
	const button = [...container.querySelectorAll<HTMLButtonElement>('.data-table-sort')].find(
		(candidate) => candidate.textContent?.startsWith(label),
	)
	if (!button) throw new Error(`No sort button for ${label}`)
	return button
}

test('sorting does not change column widths', () => {
	const container = mount()
	const initial = columnWidths(container)
	const clicks = ['Name', 'Name', 'Price', 'Price']

	for (const label of clicks) {
		sortButton(container, label).click()
		expect(columnWidths(container), `after clicking ${label}`).toEqual(initial)
	}

	const clear = container.querySelector<HTMLButtonElement>(
		'.data-table-sort-clear:not(.data-table-sort-clear-hidden)',
	)
	if (!clear) throw new Error('No visible clear button')
	clear.click()
	expect(columnWidths(container), 'after clearing').toEqual(initial)
})
