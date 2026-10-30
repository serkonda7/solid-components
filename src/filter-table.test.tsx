import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { afterEach, expect, test, vi } from 'vitest'
import {
	type DataTableColumn,
	FilterTable,
	type FilterTableFilter,
	type FilterTableSavedFilter,
	parseFilterTableRange,
} from '.'
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

test('saved filters are applied, saved, and cleared', async () => {
	const onSavedChange = vi.fn()
	const container = document.createElement('div')
	document.body.append(container)
	dispose = render(() => {
		const [saved, setSaved] = createSignal<FilterTableSavedFilter[]>([
			{ name: 'Lighting', values: { category: ['Lighting'] } },
		])
		return (
			<FilterTable
				rows={rows}
				columns={columns}
				filters={filters}
				getRowId={(row) => row.id}
				savedFilters={saved}
				onSavedFiltersChange={(next) => {
					onSavedChange(next)
					setSaved(next)
				}}
			/>
		)
	}, container)

	const picker = container.querySelector<HTMLInputElement>('input[aria-label="Saved filters"]')
	if (!picker) throw new Error('No saved filter picker')
	type(picker, 'light')
	press(picker, 'Enter')
	expect(names(container)).toEqual(['Lamp', 'Spotlight'])
	expect(picker.value).toBe('Lighting')

	const search = container.querySelector<HTMLInputElement>('input[type="search"]')
	if (!search) throw new Error('No quick search')
	type(search, 'spot')
	// No saved filter matches the edited values any more.
	expect(picker.value).toBe('')

	container.querySelector<HTMLButtonElement>('.filter-table-pill-save')?.click()
	const name = container.querySelector<HTMLInputElement>('input[aria-label="Filter name"]')
	if (!name) throw new Error('No name input')
	type(name, ' Spotlights ')
	container.querySelector<HTMLButtonElement>('.filter-table-save button[type="submit"]')?.click()
	expect(onSavedChange).toHaveBeenLastCalledWith([
		{ name: 'Lighting', values: { category: ['Lighting'] } },
		{ name: 'Spotlights', values: { category: ['Lighting'], q: 'spot' } },
	])
	expect(container.querySelector('.filter-table-save')).toBeNull()
	expect(picker.value).toBe('Spotlights')

	onSavedChange.mockClear()
	container
		.querySelector<HTMLButtonElement>('button[aria-label="Clear saved filter Spotlights"]')
		?.click()
	// Clearing resets the applied filters but keeps the quick search and the saved filter.
	expect(onSavedChange).not.toHaveBeenCalled()
	expect(names(container)).toEqual(['Spotlight'])
	expect(search.value).toBe('spot')
	expect(picker.value).toBe('')
})

test('saving is disabled without savedFilters', () => {
	const container = mount()
	tab(container, 'Filters').click()
	type(input(container, 'Name'), 'lamp')
	container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click()
	expect(container.querySelector('.filter-table-pill-save')).toBeNull()
	expect(container.querySelector('input[aria-label="Saved filters"]')).toBeNull()
})

test('quick search spans the joined column values', () => {
	const container = mount()
	const search = container.querySelector<HTMLInputElement>('input[type="search"]')
	if (!search) throw new Error('No quick search')

	type(search, 'LAMP light')
	expect(names(container)).toEqual(['Lamp'])
})

test('filters apply to new rows and sort survives filtering', () => {
	const [items, setItems] = createSignal(rows)
	const sortable = columns.map((column) => ({ ...column, sortable: true }))
	const container = document.createElement('div')
	document.body.append(container)
	dispose = render(
		() => (
			<FilterTable
				rows={items}
				columns={sortable}
				filters={filters}
				getRowId={(row) => row.id}
				defaultFilterValues={{ category: ['Lighting'] }}
				defaultSort={{ key: 'name', direction: 'desc' }}
			/>
		),
		container,
	)
	expect(names(container)).toEqual(['Spotlight', 'Lamp'])

	setItems([...rows, { id: 5, name: 'Torch', category: 'Lighting', stock: 1 }])
	expect(names(container)).toEqual(['Torch', 'Spotlight', 'Lamp'])
	expect(tab(container, 'Results').textContent).toBe('Results3')
})

test('manual filtering passes rows through', () => {
	const container = document.createElement('div')
	document.body.append(container)
	dispose = render(
		() => (
			<FilterTable
				rows={rows}
				columns={columns}
				filters={filters}
				getRowId={(row) => row.id}
				defaultFilterValues={{ name: 'lamp' }}
				manualFiltering
			/>
		),
		container,
	)
	expect(names(container)).toHaveLength(4)
})

test('custom match replaces the built-in matching', () => {
	const custom: FilterTableFilter<Row>[] = [
		{
			key: 'low',
			label: 'Low',
			type: 'text',
			match: (row, value) => row.stock < Number(value),
		},
	]
	const container = document.createElement('div')
	document.body.append(container)
	dispose = render(
		() => (
			<FilterTable
				rows={rows}
				columns={columns}
				filters={custom}
				getRowId={(row) => row.id}
				defaultFilterValues={{ low: '1' }}
			/>
		),
		container,
	)
	expect(names(container)).toEqual(['Planter', 'Spotlight'])
})

function search(container: HTMLElement): HTMLInputElement {
	const found = container.querySelector<HTMLInputElement>('input[type="search"]')
	if (!found) throw new Error('No quick search')
	return found
}

test('quick search debounces and keeps the typed text', () => {
	vi.useFakeTimers()
	try {
		const onChange = vi.fn()
		const container = document.createElement('div')
		document.body.append(container)
		dispose = render(
			() => (
				<FilterTable
					rows={rows}
					columns={columns}
					filters={filters}
					getRowId={(row) => row.id}
					quickSearchDebounce={200}
					onFilterValuesChange={onChange}
				/>
			),
			container,
		)
		const box = search(container)

		type(box, 'sp')
		vi.advanceTimersByTime(150)
		type(box, 'spo ')
		vi.advanceTimersByTime(150)
		expect(onChange).not.toHaveBeenCalled()
		expect(names(container)).toHaveLength(4)

		vi.advanceTimersByTime(50)
		expect(onChange).toHaveBeenCalledTimes(1)
		expect(onChange).toHaveBeenLastCalledWith({ q: 'spo' })
		expect(names(container)).toEqual(['Spotlight'])
		expect(box.value).toBe('spo ')

		type(box, 'lamp')
		press(box, 'Enter')
		expect(onChange).toHaveBeenLastCalledWith({ q: 'lamp' })
		vi.advanceTimersByTime(500)
		expect(onChange).toHaveBeenCalledTimes(2)
	} finally {
		vi.useRealTimers()
	}
})

test('manual filtering debounces by default and other changes keep a pending search', () => {
	vi.useFakeTimers()
	try {
		const onChange = vi.fn()
		const container = document.createElement('div')
		document.body.append(container)
		dispose = render(
			() => (
				<FilterTable
					rows={rows}
					columns={columns}
					filters={filters}
					getRowId={(row) => row.id}
					defaultFilterValues={{ name: 'a' }}
					onFilterValuesChange={onChange}
					manualFiltering
				/>
			),
			container,
		)
		type(search(container), 'lamp')
		expect(onChange).not.toHaveBeenCalled()

		container.querySelector<HTMLButtonElement>('.filter-table-pill')?.click()
		expect(onChange).toHaveBeenCalledTimes(1)
		expect(onChange).toHaveBeenLastCalledWith({ q: 'lamp' })
		expect(search(container).value).toBe('lamp')

		vi.advanceTimersByTime(500)
		expect(onChange).toHaveBeenCalledTimes(1)
	} finally {
		vi.useRealTimers()
	}
})

test('derived select options survive manually filtered rows', () => {
	const [items, setItems] = createSignal(rows)
	const container = document.createElement('div')
	document.body.append(container)
	dispose = render(
		() => (
			<FilterTable
				rows={items}
				columns={columns}
				filters={filters}
				getRowId={(row) => row.id}
				manualFiltering
			/>
		),
		container,
	)
	setItems(rows.filter((row) => row.category === 'Audio'))

	tab(container, 'Filters').click()
	const category = input(container, 'Category')
	type(category, 'light')
	press(category, 'Enter')
	expect(container.querySelector('.filter-table-chip')?.textContent).toBe('Lighting')
})

test('derived select options follow the rows without manual filtering', () => {
	const [items, setItems] = createSignal(rows)
	const container = document.createElement('div')
	document.body.append(container)
	dispose = render(
		() => (
			<FilterTable
				rows={items}
				columns={columns}
				filters={filters}
				getRowId={(row) => row.id}
			/>
		),
		container,
	)
	setItems(rows.filter((row) => row.category === 'Audio'))

	tab(container, 'Filters').click()
	const category = input(container, 'Category')
	type(category, 'light')
	press(category, 'Enter')
	expect(container.querySelector('.filter-table-chip')).toBeNull()
})

test('results badge prefers totalCount, then pagination, then the shown rows', () => {
	const [total, setTotal] = createSignal<number | undefined>(120)
	const container = document.createElement('div')
	document.body.append(container)
	dispose = render(
		() => (
			<FilterTable
				rows={rows}
				columns={columns}
				filters={filters}
				getRowId={(row) => row.id}
				totalCount={total}
				pagination={{ page: 1, pageSize: 25, rowCount: 80 }}
				manualFiltering
			/>
		),
		container,
	)
	expect(tab(container, 'Results').textContent).toBe('Results120')

	setTotal(undefined)
	expect(tab(container, 'Results').textContent).toBe('Results80')
})

test('manual filtering without pagination shows totalCount', () => {
	const container = document.createElement('div')
	document.body.append(container)
	dispose = render(
		() => (
			<FilterTable
				rows={rows}
				columns={columns}
				filters={filters}
				getRowId={(row) => row.id}
				totalCount={120}
				manualFiltering
			/>
		),
		container,
	)
	expect(tab(container, 'Results').textContent).toBe('Results120')
})

type Dated = Row & { added: string | Date | null }

const dated: Dated[] = [
	{ ...rows[0], added: '2026-01-10' } as Dated,
	{ ...rows[1], added: new Date(2026, 1, 15, 23, 30) } as Dated,
	{ ...rows[2], added: new Date(2026, 2, 20, 12).toISOString() } as Dated,
	{ ...rows[3], added: null } as Dated,
]

const rangeFilters: FilterTableFilter<Dated>[] = [
	{ key: 'stock', label: 'Stock', type: 'number-range' },
	{
		key: 'added',
		label: 'Added',
		type: 'date-range',
		formatValue: (value) => value.split('-').reverse().join('.'),
	},
]

function mountRanges(values: Record<string, string>, onChange?: (v: unknown) => void) {
	const container = document.createElement('div')
	document.body.append(container)
	dispose = render(
		() => (
			<FilterTable
				rows={dated}
				columns={columns as DataTableColumn<Dated>[]}
				filters={rangeFilters}
				getRowId={(row) => row.id}
				defaultFilterValues={values}
				onFilterValuesChange={onChange}
			/>
		),
		container,
	)
	return container
}

test('number range filters are inclusive, open ended, and skip empty values', () => {
	expect(names(mountRanges({ stock: '1..2' }))).toEqual(['Speaker'])
	dispose?.()
	document.body.innerHTML = ''

	expect(names(mountRanges({ stock: '2..' }))).toEqual(['Lamp', 'Speaker'])
	dispose?.()
	document.body.innerHTML = ''

	expect(names(mountRanges({ stock: '..0' }))).toEqual(['Planter', 'Spotlight'])
})

test('date range filters compare local days of any date value', () => {
	expect(names(mountRanges({ added: '2026-02-15..2026-03-20' }))).toEqual(['Planter', 'Speaker'])
	dispose?.()
	document.body.innerHTML = ''

	expect(names(mountRanges({ added: '..2026-01-10' }))).toEqual(['Lamp'])
})

test('range form applies bounds and pills format them', () => {
	const onChange = vi.fn()
	const container = mountRanges({}, onChange)
	tab(container, 'Filters').click()

	const stock = container.querySelector<HTMLInputElement>('input[aria-label="Stock To"]')
	if (!stock) throw new Error('No range input')
	type(input(container, 'Stock'), '1')
	type(stock, '4')
	type(input(container, 'Added'), '2026-01-01')
	container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click()

	expect(onChange).toHaveBeenLastCalledWith({ stock: '1..4', added: '2026-01-01..' })
	expect(names(container)).toEqual(['Lamp', 'Speaker'])
	const pills = [...container.querySelectorAll<HTMLButtonElement>('.filter-table-pill')]
	expect(pills.map((p) => p.textContent)).toEqual([
		'Stock: 1 – 4',
		'Added: ≥ 01.01.2026',
		'Clear all',
	])

	pills[0]?.click()
	expect(onChange).toHaveBeenLastCalledWith({ added: '2026-01-01..' })

	tab(container, 'Filters').click()
	type(input(container, 'Added'), '')
	container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click()
	expect(onChange).toHaveBeenLastCalledWith({})
})

test('parseFilterTableRange splits open bounds', () => {
	expect(parseFilterTableRange('1.5..2')).toEqual({ min: '1.5', max: '2' })
	expect(parseFilterTableRange('..2')).toEqual({ min: '', max: '2' })
	expect(parseFilterTableRange('2026-01-01..')).toEqual({ min: '2026-01-01', max: '' })
})
