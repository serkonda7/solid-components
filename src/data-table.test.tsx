import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { afterEach, expect, test } from 'vitest'
import {
	DataTable,
	type DataTableColumn,
	type DataTablePagination,
	type DataTableProps,
	type DataTableSort,
	FilterTable,
} from '.'
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

function mountTable(extra: Partial<DataTableProps<Row>> = {}, width = '600px'): HTMLElement {
	const container = document.createElement('div')
	container.style.width = width
	document.body.append(container)
	dispose = render(
		() => <DataTable rows={rows} columns={columns} getRowId={(row) => row.id} {...extra} />,
		container,
	)
	return container
}

function pressOnHandle(container: HTMLElement, init: KeyboardEventInit): void {
	container
		.querySelector('.data-table-resize-handle')
		?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
}

const edit = () => <button type="button">Edit</button>

test('column widths can be restored', () => {
	const container = mountTable({
		columnWidths: { name: 200, price: 100, id: 80 },
		rowActions: edit,
		resizableColumns: true,
	})
	const [name, price, id, actions] = columnWidths(container)
	expect([name, price, id]).toEqual([200, 100, 80])
	expect(actions).toBeGreaterThan(0)
	const table = container.querySelector('table')
	expect(table?.classList.contains('data-table-resized')).toBe(true)
	expect(table?.getBoundingClientRect().width).toBeCloseTo(380 + (actions ?? 0), 0)
})

test('restored widths fit columns missing from them and follow the prop', () => {
	const [saved, setSaved] = createSignal<Record<string, number>>({})
	const container = mountTable({ columnWidths: saved })
	const auto = columnWidths(container)

	setSaved({ name: 200, price: 100 })
	const [name, price, id] = columnWidths(container)
	expect([name, price]).toEqual([200, 100])
	expect(id).toBeGreaterThanOrEqual(40)

	setSaved({})
	expect(columnWidths(container)).toEqual(auto)
})

test('actions column grows for rows that arrive after widths were restored', () => {
	const [items, setItems] = createSignal<Row[]>([])
	const container = mountTable({
		rows: items,
		columnWidths: { name: 100, price: 100, id: 100 },
		rowActions: () => <button type="button">A very long action label</button>,
	})
	setItems(rows)
	const cell = container.querySelector<HTMLElement>('td.data-table-actions')
	expect(cell?.scrollWidth).toBe(cell?.clientWidth)
	expect(cell?.querySelector('button')?.getBoundingClientRect().right).toBeLessThanOrEqual(
		cell?.getBoundingClientRect().right ?? 0,
	)
})

test('reset clears column widths', () => {
	const changes: Record<string, number>[] = []
	const container = mountCustomizer({
		resizableColumns: true,
		onColumnWidthsChange: (widths) => changes.push(widths),
	})
	pressOnHandle(container, { key: 'ArrowRight' })
	expect(container.querySelector('table')?.style.width).not.toBe('')

	container
		.querySelectorAll<HTMLButtonElement>('.data-table-customizer-actions button')[1]
		?.click()
	expect(changes.at(-1)).toEqual({})
	const table = container.querySelector('table')
	expect(table?.classList.contains('data-table-resized')).toBe(false)
	expect(table?.style.width).toBe('')
	expect(container.querySelector('th')?.style.width).toBe('')
})

test('double-clicking a resize handle fits the column in both directions', () => {
	const changes: Record<string, number>[] = []
	const container = mountTable({
		columnWidths: { name: 300, price: 100, id: 100 },
		resizableColumns: true,
		onColumnWidthsChange: (widths) => changes.push(widths),
	})
	const handle = container.querySelector('.data-table-resize-handle')
	handle?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
	const [fitted, price] = columnWidths(container)
	expect(fitted).toBeLessThan(100)
	expect(price).toBe(100)
	expect(changes.at(-1)?.name).toBe(fitted)

	pressOnHandle(container, { key: 'ArrowLeft' })
	pressOnHandle(container, { key: 'ArrowLeft' })
	pressOnHandle(container, { key: 'Enter' })
	expect(columnWidths(container)[0]).toBe(fitted)
})

test('autofit does not wrap long cell content', () => {
	const long = 'A value that is much wider than its pinned column'
	const container = mountTable({
		rows: [{ id: 1, name: long, price: 1 }],
		columnWidths: { name: 80, price: 100, id: 100 },
		resizableColumns: true,
	})
	const cell = container.querySelector('td')
	const lineHeight = cell?.getBoundingClientRect().height ?? 0
	expect(lineHeight).toBeGreaterThan(30)
	container
		.querySelector('.data-table-resize-handle')
		?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
	expect(cell?.getBoundingClientRect().height).toBeLessThan(lineHeight)
})

function customizerLabels(container: HTMLElement): string[] {
	return [...container.querySelectorAll('.data-table-customizer-item')].map(
		(item) => item.textContent ?? '',
	)
}

test('Alt+Arrow moves a customizer item and keeps focus on it', () => {
	const changes: string[][] = []
	const container = mountCustomizer({ onColumnOrderChange: (keys) => changes.push(keys) })
	const box = container.querySelector<HTMLInputElement>('.data-table-customizer-item input')
	box?.focus()
	const press = (key: string, altKey: boolean) =>
		document.activeElement?.dispatchEvent(
			new KeyboardEvent('keydown', { key, altKey, bubbles: true, cancelable: true }),
		)

	press('ArrowDown', false)
	press('ArrowUp', true)
	expect(changes).toEqual([])

	press('ArrowDown', true)
	press('ArrowDown', true)
	expect(customizerLabels(container)).toEqual(['Price', 'ID', 'Name'])
	expect(headers(container)).toEqual(['Price', 'ID', 'Name'])
	expect(document.activeElement).toBe(box)

	press('ArrowDown', true)
	expect(changes).toHaveLength(2)
})

test('a non-toggleable customizer item is reachable through its grip', () => {
	const container = mountCustomizer({
		columns: [{ ...columns[0], key: 'name', toggleable: false }, ...columns.slice(1)],
	})
	const grips = container.querySelectorAll<HTMLElement>('.data-table-customizer-grip')
	expect([...grips].map((grip) => grip.tabIndex)).toEqual([0, -1, -1])

	grips[0]?.focus()
	grips[0]?.dispatchEvent(
		new KeyboardEvent('keydown', {
			key: 'ArrowDown',
			altKey: true,
			bubbles: true,
			cancelable: true,
		}),
	)
	expect(customizerLabels(container)).toEqual(['Price', 'Name', 'ID'])
	expect(document.activeElement).toBe(grips[0])
})

test('a touch drag on the grip reorders columns', () => {
	const container = mountCustomizer()
	const items = container.querySelectorAll<HTMLElement>('.data-table-customizer-item')
	const target = items[2]?.getBoundingClientRect()
	const point = { clientX: (target?.left ?? 0) + 5, clientY: (target?.top ?? 0) + 5 }

	items[0]
		?.querySelector('.data-table-customizer-grip')
		?.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }))
	expect(items[0]?.classList.contains('data-table-customizer-item-dragging')).toBe(true)
	document.dispatchEvent(new PointerEvent('pointermove', point))
	document.dispatchEvent(new PointerEvent('pointerup', point))

	expect(customizerLabels(container)).toEqual(['Price', 'ID', 'Name'])
	expect(items[0]?.classList.contains('data-table-customizer-item-dragging')).toBe(false)
	document.dispatchEvent(new PointerEvent('pointermove', { clientX: 0, clientY: 0 }))
	expect(customizerLabels(container)).toEqual(['Price', 'ID', 'Name'])
})

test('sticky header stays visible while scrolling and sits above sticky actions', () => {
	const container = mountTable({
		rows: Array.from({ length: 50 }, (_, i) => ({ id: i, name: `Row ${i}`, price: i })),
		rowActions: edit,
		stickyHeader: true,
		stickyActions: true,
	})
	container.style.setProperty('--data-table-max-height', '200px')
	const scroller = container.querySelector('.data-table-scroll') as HTMLElement
	expect(scroller.getBoundingClientRect().height).toBe(200)

	scroller.scrollTop = 300
	const th = container.querySelector('th') as HTMLElement
	expect(th.getBoundingClientRect().top).toBeCloseTo(scroller.getBoundingClientRect().top, 0)
	const actionsTh = container.querySelector<HTMLElement>('th.data-table-actions')
	const actionsTd = container.querySelector<HTMLElement>('td.data-table-actions')
	expect(Number(getComputedStyle(actionsTh as Element).zIndex)).toBeGreaterThan(
		Number(getComputedStyle(th).zIndex),
	)
	expect(Number(getComputedStyle(th).zIndex)).toBeGreaterThan(
		Number(getComputedStyle(actionsTd as Element).zIndex),
	)
})

test('sticky actions stay visible while scrolling sideways', () => {
	const container = mountTable(
		{
			columnWidths: { name: 300, price: 300, id: 300 },
			rowActions: edit,
			stickyActions: true,
		},
		'400px',
	)
	const scroller = container.querySelector('.data-table-scroll') as HTMLElement
	scroller.scrollLeft = 100
	const cell = container.querySelector('td.data-table-actions')
	expect(cell?.getBoundingClientRect().right).toBeCloseTo(
		scroller.getBoundingClientRect().right,
		0,
	)
})

test('unsorted sortable headers show an affordance of the same width', () => {
	const container = mountTable()
	const indicator = container.querySelector('.data-table-sort-indicator') as HTMLElement
	expect(getComputedStyle(indicator, '::before').content).toBe('"↕"')
	expect(indicator.textContent).toBe('')
	const width = indicator.getBoundingClientRect().width

	sortButton(container, 'Name').click()
	expect(getComputedStyle(indicator, '::before').content).toBe('none')
	expect(indicator.getBoundingClientRect().width).toBe(width)
})

test('loading without rows shows skeleton rows instead of the text', () => {
	const [loading, setLoading] = createSignal(true)
	const [items, setItems] = createSignal<Row[]>([])
	const container = mountTable({
		rows: items,
		loading,
		skeletonRows: 3,
		rowActions: edit,
	})
	expect(container.querySelectorAll('tbody tr')).toHaveLength(3)
	expect(container.querySelectorAll('.data-table-skeleton')).toHaveLength(12)
	expect(container.querySelector('table')?.getAttribute('aria-busy')).toBe('true')
	const status = container.querySelector('.data-table-status')
	expect(status?.classList.contains('data-table-visually-hidden')).toBe(true)

	setItems(rows)
	setLoading(false)
	expect(container.querySelector('.data-table-skeleton')).toBeNull()
	expect(container.querySelector('table')?.getAttribute('aria-busy')).toBe('false')
})

test('loading with rows keeps them and shows the text', () => {
	const container = mountTable({ loading: true })
	expect(container.querySelector('.data-table-skeleton')).toBeNull()
	expect(columnText(container, 0)).toEqual(['B', 'A', 'C'])
	const status = container.querySelector('.data-table-status')
	expect(status?.classList.contains('data-table-visually-hidden')).toBe(false)
})

test('loadingContent replaces the skeleton', () => {
	const container = mountTable({
		rows: [],
		loading: true,
		loadingContent: <p class="custom">Wait</p>,
	})
	expect(container.querySelector('.data-table-skeleton')).toBeNull()
	expect(container.querySelector('.custom')).not.toBeNull()
})

function pagerButtons(container: HTMLElement): HTMLButtonElement[] {
	return [...container.querySelectorAll<HTMLButtonElement>('.data-table-pagination button')]
}

test('pagination reports the next page and passes rows through', () => {
	const changes: unknown[] = []
	const [state, setState] = createSignal<DataTablePagination>({
		page: 1,
		pageSize: 3,
		rowCount: 7,
		pageSizeOptions: [3, 10],
	})
	const container = mountTable({
		pagination: state,
		onPaginationChange: (next) => {
			changes.push(next)
			setState({ ...state(), ...next })
		},
	})
	const nav = container.querySelector('.data-table-pagination') as HTMLElement
	const [previous, next] = pagerButtons(container)
	expect(columnText(container, 0)).toEqual(['B', 'A', 'C'])
	expect(nav.textContent).toContain('1–3 of 7')
	expect(previous?.disabled).toBe(true)

	next?.click()
	next?.click()
	expect(nav.textContent).toContain('7–7 of 7')
	expect(next?.disabled).toBe(true)
	expect(changes).toEqual([
		{ page: 2, pageSize: 3 },
		{ page: 3, pageSize: 3 },
	])

	const select = nav.querySelector('select') as HTMLSelectElement
	select.value = '10'
	select.dispatchEvent(new Event('change', { bubbles: true }))
	expect(changes.at(-1)).toEqual({ page: 1, pageSize: 10 })
	expect(nav.textContent).toContain('1–7 of 7')
	expect(next?.disabled).toBe(true)
})

test('pagination handles an empty result and custom labels', () => {
	const container = mountTable({
		rows: [],
		pagination: { page: 1, pageSize: 10, rowCount: 0 },
		paginationLabels: { range: (first, last, count) => `${first}-${last}/${count}` },
	})
	const nav = container.querySelector('.data-table-pagination')
	expect(nav?.textContent).toBe('0-0/0')
	expect(nav?.querySelector('select')).toBeNull()
	expect(pagerButtons(container).every((button) => button.disabled)).toBe(true)
})

test('FilterTable counts all pages in its results badge', () => {
	const container = document.createElement('div')
	document.body.append(container)
	dispose = render(
		() => (
			<FilterTable
				rows={rows}
				columns={columns}
				filters={[]}
				getRowId={(row) => row.id}
				manualFiltering
				pagination={{ page: 1, pageSize: 3, rowCount: 42 }}
			/>
		),
		container,
	)
	expect(container.querySelector('.filter-table-badge')?.textContent).toBe('42')
})
