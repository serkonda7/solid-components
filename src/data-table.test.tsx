import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { afterEach, expect, test } from 'vitest'
import { DataTable, type DataTableColumn, type DataTableProps, type DataTableSort } from '.'
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
	const clicks = ['Name', 'Name', 'Name', 'Price', 'Price', 'Price']

	for (const label of clicks) {
		sortButton(container, label).click()
		expect(columnWidths(container), `after clicking ${label}`).toEqual(initial)
	}
})

function columnText(container: HTMLElement, index: number): string[] {
	return [...container.querySelectorAll('tbody tr')].map(
		(tr) => tr.children[index]?.textContent ?? '',
	)
}

test('clicking a header cycles asc, desc, unsorted', () => {
	const container = mount()
	const name = sortButton(container, 'Name')
	const th = name.closest('th')

	name.click()
	expect(th?.getAttribute('aria-sort')).toBe('ascending')
	expect(columnText(container, 0)).toEqual(['A', 'B', 'C'])

	name.click()
	expect(th?.getAttribute('aria-sort')).toBe('descending')
	expect(columnText(container, 0)).toEqual(['C', 'B', 'A'])

	name.click()
	expect(th?.getAttribute('aria-sort')).toBe('none')
	expect(columnText(container, 0)).toEqual(['B', 'A', 'C'])
})

function headers(container: HTMLElement): string[] {
	return [...container.querySelectorAll('thead th')].map((th) => th.textContent ?? '')
}

function dragOnto(container: HTMLElement, from: number, to: number): void {
	const items = container.querySelectorAll<HTMLElement>('.data-table-customizer-item')
	items[from]?.dispatchEvent(new Event('dragstart', { bubbles: true }))
	items[to]?.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }))
	items[from]?.dispatchEvent(new Event('dragend', { bubbles: true }))
}

function mountCustomizer(extra: Partial<DataTableProps<Row>> = {}): HTMLElement {
	const container = document.createElement('div')
	document.body.append(container)
	dispose = render(
		() => (
			<DataTable
				rows={rows}
				columns={columns}
				getRowId={(row) => row.id}
				showColumnCustomizer
				{...extra}
			/>
		),
		container,
	)
	container.querySelector<HTMLButtonElement>('.data-table-customizer-button')?.click()
	return container
}

test('customizer moves columns and reset restores the order', () => {
	const changes: string[][] = []
	const container = mountCustomizer({ onColumnOrderChange: (keys) => changes.push(keys) })

	dragOnto(container, 0, 1)
	expect(headers(container)).toEqual(['Price', 'Name', 'ID'])
	expect(columnText(container, 1)).toEqual(['B', 'A', 'C'])

	dragOnto(container, 2, 1)
	expect(headers(container)).toEqual(['Price', 'ID', 'Name'])
	expect(changes).toEqual([
		['price', 'name', 'id'],
		['price', 'id', 'name'],
	])

	container
		.querySelectorAll<HTMLButtonElement>('.data-table-customizer-actions button')[1]
		?.click()
	expect(headers(container)).toEqual(['Name', 'Price', 'ID'])
})

test('column order can be controlled', () => {
	const changes: string[][] = []
	const container = mountCustomizer({
		columnOrder: ['id', 'unknown', 'name'],
		onColumnOrderChange: (keys) => changes.push(keys),
	})
	expect(headers(container)).toEqual(['ID', 'Name', 'Price'])

	dragOnto(container, 0, 1)
	expect(changes).toEqual([['name', 'id', 'price']])
	expect(headers(container)).toEqual(['ID', 'Name', 'Price'])
})

test('re-showing a hidden column in a resized table fits it to its content', async () => {
	const [visible, setVisible] = createSignal(['name', 'price'])
	const container = document.createElement('div')
	container.style.width = '600px'
	document.body.append(container)
	dispose = render(
		() => (
			<DataTable
				rows={rows}
				columns={columns}
				getRowId={(row) => row.id}
				visibleColumns={visible()}
				resizableColumns
			/>
		),
		container,
	)

	const handle = container.querySelector<HTMLElement>('.data-table-resize-handle')
	handle?.dispatchEvent(
		new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
	)
	await Promise.resolve()

	setVisible(['name', 'price', 'id'])
	await Promise.resolve()

	const idHeader = container.querySelector<HTMLElement>('th[data-column-key="id"]')
	expect(idHeader?.getBoundingClientRect().width).toBeGreaterThanOrEqual(40)
})

test('new rows and columns update the table', () => {
	const [items, setItems] = createSignal(rows)
	const [cols, setCols] = createSignal(columns)
	const container = document.createElement('div')
	document.body.append(container)
	dispose = render(
		() => (
			<DataTable
				rows={items}
				columns={cols()}
				getRowId={(row) => row.id}
				defaultSort={{ key: 'price', direction: 'desc' }}
			/>
		),
		container,
	)
	expect(columnText(container, 0)).toEqual(['A', 'B', 'C'])

	const added = { id: 4, name: 'D', price: 5 }
	const first = container.querySelector('tbody tr')
	setItems([...rows, added])
	expect(columnText(container, 0)).toEqual(['A', 'D', 'B', 'C'])
	// Rows are keyed by the consumer's objects, so existing ones keep their DOM.
	expect(container.querySelector('tbody tr')).toBe(first)

	setCols([...columns].reverse())
	expect(headers(container)).toEqual(['ID', 'Price▼', 'Name'])
	expect(columnText(container, 2)).toEqual(['A', 'D', 'B', 'C'])
})

test('controlled sort only reports the next state', () => {
	const sorts: unknown[] = []
	const keys: string[] = []
	let clears = 0
	const [sort, setSort] = createSignal<DataTableSort | undefined>({
		key: 'name',
		direction: 'desc',
	})
	const container = document.createElement('div')
	document.body.append(container)
	dispose = render(
		() => (
			<DataTable
				rows={rows}
				columns={columns}
				getRowId={(row) => row.id}
				sortKey={() => sort()?.key}
				sortDirection={() => sort()?.direction ?? 'asc'}
				onSort={(key) => keys.push(key)}
				onSortClear={() => clears++}
				onSortChange={(next) => {
					sorts.push(next)
					setSort(next)
				}}
			/>
		),
		container,
	)
	expect(columnText(container, 0)).toEqual(['B', 'A', 'C'])

	sortButton(container, 'Name').click()
	sortButton(container, 'Price').click()
	expect(sorts).toEqual([undefined, { key: 'price', direction: 'asc' }])
	expect(keys).toEqual(['name', 'price'])
	expect(clears).toBe(1)
	expect(columnText(container, 0)).toEqual(['B', 'A', 'C'])
})

test('column visibility can be toggled and shown again', () => {
	const changes: string[][] = []
	const container = mountCustomizer({
		columns: [...columns.slice(0, 2), { ...columns[2], key: 'id', toggleable: false }],
		onVisibleColumnsChange: (keys) => changes.push(keys),
	})
	const boxes = container.querySelectorAll<HTMLInputElement>('.data-table-customizer-item input')
	expect(boxes[2]?.disabled).toBe(true)

	boxes[0]?.click()
	expect(headers(container)).toEqual(['Price', 'ID'])

	container
		.querySelectorAll<HTMLButtonElement>('.data-table-customizer-actions button')[0]
		?.click()
	expect(headers(container)).toEqual(['Name', 'Price', 'ID'])
	expect(changes).toEqual([['price'], ['name', 'price']])
})

test('resizing by keyboard pins widths and reports them', () => {
	const changes: Record<string, number>[] = []
	const container = document.createElement('div')
	container.style.width = '600px'
	document.body.append(container)
	dispose = render(
		() => (
			<DataTable
				rows={rows}
				columns={columns}
				getRowId={(row) => row.id}
				rowActions={() => <button type="button">Edit</button>}
				resizableColumns
				onColumnWidthsChange={(widths) => changes.push(widths)}
			/>
		),
		container,
	)
	const table = container.querySelector('table') as HTMLElement
	const before = columnWidths(container)
	const tableBefore = table.getBoundingClientRect().width

	container
		.querySelector('.data-table-resize-handle')
		?.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
		)

	const after = columnWidths(container)
	expect(after[0]).toBeCloseTo((before[0] ?? 0) + 10, 0)
	expect(after[1]).toBeCloseTo(before[1] ?? 0, 0)
	expect(table.getBoundingClientRect().width).toBeCloseTo(tableBefore + 10, 0)
	expect(Object.keys(changes[0] ?? {})).toEqual(['name', 'price', 'id'])
})
