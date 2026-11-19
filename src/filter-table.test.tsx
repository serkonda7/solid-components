import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { afterEach, expect, test, vi } from 'vitest'
import {
	type DataTableColumn,
	FILTER_TABLE_EMPTY,
	FilterTable,
	type FilterTableFilter,
	type FilterTableProps,
	type FilterTableSavedFilter,
	type FilterTableValues,
	parseFilterTableRange,
	parseFilterTableSelect,
	resolveFilterTableDate,
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

function mountStored(props: Partial<FilterTableProps<Row>>): HTMLElement {
	const container = document.createElement('div')
	document.body.append(container)
	dispose = render(
		() => (
			<FilterTable
				rows={rows}
				columns={columns}
				filters={filters}
				getRowId={(row) => row.id}
				{...props}
			/>
		),
		container,
	)
	return container
}

test('filterStorageKey restores and saves filters but not the quick search', () => {
	const key = 'test:filters:storage'
	localStorage.setItem(key, JSON.stringify({ category: ['Lighting'], gone: 'x', q: 'lamp' }))
	try {
		const container = mountStored({
			filterStorageKey: key,
			defaultFilterValues: { in_stock: 'true', q: 'sp' },
		})
		expect(names(container)).toEqual(['Spotlight'])

		container.querySelector<HTMLButtonElement>('.filter-table-pill')?.click()
		expect(JSON.parse(localStorage.getItem(key) ?? 'null')).toEqual({})
		expect(names(container)).toEqual(['Speaker', 'Spotlight'])
	} finally {
		localStorage.removeItem(key)
	}
})

test('filterStorageKey emits restored filters once when controlled', () => {
	const key = 'test:filters:controlled'
	localStorage.setItem(key, JSON.stringify({ category: ['Decor'] }))
	try {
		const [values, setValues] = createSignal<FilterTableValues>({ q: 'pl' })
		const changes: FilterTableValues[] = []
		const container = mountStored({
			filterStorageKey: key,
			filterValues: values,
			onFilterValuesChange: (next) => {
				changes.push(next)
				setValues(next)
			},
		})
		expect(changes).toEqual([{ category: ['Decor'], q: 'pl' }])
		expect(names(container)).toEqual(['Planter'])
	} finally {
		localStorage.removeItem(key)
	}
})

test('restoreFilters={false} and corrupt entries skip the restore but keep saving', () => {
	const key = 'test:filters:skip'
	localStorage.setItem(key, JSON.stringify({ category: ['Decor'] }))
	try {
		const onChange = vi.fn()
		const container = mountStored({
			filterStorageKey: key,
			restoreFilters: false,
			filterValues: {},
			onFilterValuesChange: onChange,
		})
		expect(onChange).not.toHaveBeenCalled()
		expect(names(container)).toHaveLength(4)
		dispose?.()
		document.body.innerHTML = ''

		localStorage.setItem(key, '{not json')
		const corrupt = mountStored({ filterStorageKey: key })
		expect(names(corrupt)).toHaveLength(4)
		tab(corrupt, 'Filters').click()
		const category = input(corrupt, 'Category')
		type(category, 'audio')
		press(category, 'Enter')
		corrupt.querySelector<HTMLButtonElement>('button[type="submit"]')?.click()
		expect(JSON.parse(localStorage.getItem(key) ?? 'null')).toEqual({ category: ['Audio'] })
	} finally {
		localStorage.removeItem(key)
	}
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

test('quick search requires every word, in any order and case', () => {
	const container = mount()
	const search = container.querySelector<HTMLInputElement>('input[type="search"]')
	if (!search) throw new Error('No quick search')

	type(search, 'lighting SP')
	expect(names(container)).toEqual(['Spotlight'])
	type(search, '  light   lamp ')
	expect(names(container)).toEqual(['Lamp'])
	type(search, 'lamp audio')
	expect(names(container)).toEqual([])
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
	expect(container.querySelector('.combobox-chip')?.textContent).toBe('Lighting')
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
	expect(container.querySelector('.combobox-chip')).toBeNull()
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

type Tagged = Row & { tags: string[]; note: string | null; added: Date | null }

const daysAgo = (days: number) => {
	const date = new Date()
	date.setDate(date.getDate() - days)
	return date
}

const tagged: Tagged[] = [
	{ ...rows[0], tags: ['new', 'sale'], note: 'fragile', added: daysAgo(0) },
	{ ...rows[1], tags: [], note: null, added: daysAgo(10) },
	{ ...rows[2], tags: ['sale'], note: ' ', added: daysAgo(40) },
	{ ...rows[3], tags: ['new'], note: 'bright', added: null },
] as Tagged[]

const advancedFilters: FilterTableFilter<Tagged>[] = [
	{ key: 'category', label: 'Category', type: 'select' },
	{ key: 'tags', label: 'Tags', type: 'select', empty: true },
	{ key: 'note', label: 'Note', type: 'text', empty: true },
	{ key: 'stock', label: 'Stock', type: 'number-range', empty: true },
	{ key: 'added', label: 'Added', type: 'date-range', empty: true },
]

function mountAdvanced(values: FilterTableValues, onChange?: (v: unknown) => void) {
	const container = document.createElement('div')
	document.body.append(container)
	dispose = render(
		() => (
			<FilterTable
				rows={tagged}
				columns={columns as DataTableColumn<Tagged>[]}
				filters={advancedFilters}
				getRowId={(row) => row.id}
				defaultFilterValues={values}
				onFilterValuesChange={onChange}
			/>
		),
		container,
	)
	return container
}

function remount(values: FilterTableValues): string[] {
	dispose?.()
	document.body.innerHTML = ''
	return names(mountAdvanced(values))
}

function pillTexts(container: HTMLElement): string[] {
	return [...container.querySelectorAll('.filter-table-pill')].map((p) => p.textContent ?? '')
}

function combobox(container: HTMLElement, label: string): HTMLInputElement {
	const found = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)
	if (!found) throw new Error(`No combobox ${label}`)
	return found
}

function pick(input: HTMLInputElement, label: string): void {
	input.focus()
	input.dispatchEvent(new MouseEvent('click', { bubbles: true }))
	const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
		(o) => o.textContent === label,
	)
	if (!option) throw new Error(`No option ${label}`)
	option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
	option.click()
}

test('select values prefixed with ! exclude, alone or with included values', () => {
	expect(remount({ category: ['!Lighting'] })).toEqual(['Planter', 'Speaker'])
	expect(remount({ tags: ['!sale'] })).toEqual(['Planter', 'Spotlight'])
	expect(remount({ tags: ['new', '!sale'] })).toEqual(['Spotlight'])
	expect(parseFilterTableSelect(['a', '!b'])).toEqual({ include: ['a'], exclude: ['b'] })
})

test('the is not operator prefixes the picked values and pills show them', () => {
	const onChange = vi.fn()
	const container = mountAdvanced({ category: ['Lighting'] }, onChange)
	tab(container, 'Filters').click()
	const operator = combobox(container, 'Category condition')
	expect(operator.value).toBe('is')

	pick(operator, 'is not')
	container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click()
	expect(onChange).toHaveBeenLastCalledWith({ category: ['!Lighting'] })
	expect(names(container)).toEqual(['Planter', 'Speaker'])
	expect(pillTexts(container)).toEqual(['Category: ≠ Lighting', 'Clear all'])

	tab(container, 'Filters').click()
	expect(operator.value).toBe('is not')
})

test('empty and not empty match missing values for every filter type', () => {
	expect(remount({ tags: [FILTER_TABLE_EMPTY] })).toEqual(['Planter'])
	expect(remount({ tags: [`!${FILTER_TABLE_EMPTY}`] })).toEqual(['Lamp', 'Speaker', 'Spotlight'])
	expect(remount({ tags: [FILTER_TABLE_EMPTY, 'sale'] })).toEqual(['Lamp', 'Planter', 'Speaker'])
	expect(remount({ note: FILTER_TABLE_EMPTY })).toEqual(['Planter', 'Speaker'])
	expect(remount({ note: `!${FILTER_TABLE_EMPTY}` })).toEqual(['Lamp', 'Spotlight'])
	expect(remount({ added: FILTER_TABLE_EMPTY })).toEqual(['Spotlight'])
	expect(remount({ stock: `!${FILTER_TABLE_EMPTY}` })).toEqual([
		'Lamp',
		'Planter',
		'Speaker',
		'Spotlight',
	])
})

test('None picks rows without a value, and is not None rows with one', () => {
	const onChange = vi.fn()
	const container = mountAdvanced({}, onChange)
	tab(container, 'Filters').click()
	expect(container.querySelector('input[aria-label="Note condition"]')).toBeNull()

	pick(input(container, 'Tags'), 'None')
	container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click()
	expect(onChange).toHaveBeenLastCalledWith({ tags: [FILTER_TABLE_EMPTY] })
	expect(names(container)).toEqual(['Planter'])
	expect(pillTexts(container)).toEqual(['Tags: None', 'Clear all'])

	tab(container, 'Filters').click()
	pick(combobox(container, 'Tags condition'), 'is not')
	container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click()
	expect(onChange).toHaveBeenLastCalledWith({ tags: [`!${FILTER_TABLE_EMPTY}`] })
	expect(names(container)).toEqual(['Lamp', 'Speaker', 'Spotlight'])
	expect(pillTexts(container)).toEqual(['Tags: ≠ None', 'Clear all'])
})

test('relative date bounds resolve against today', () => {
	const now = new Date(2026, 2, 31, 15)
	expect(resolveFilterTableDate('today', now)).toBe('2026-03-31')
	expect(resolveFilterTableDate('-6d', now)).toBe('2026-03-25')
	expect(resolveFilterTableDate('+1w', now)).toBe('2026-04-07')
	expect(resolveFilterTableDate('-1m', now)).toBe('2026-02-28')
	expect(resolveFilterTableDate('-1y', now)).toBe('2025-03-31')
	expect(resolveFilterTableDate('2026-01-02', now)).toBe('2026-01-02')
	expect(resolveFilterTableDate('', now)).toBe('')

	expect(remount({ added: '-6d..today' })).toEqual(['Lamp'])
	expect(remount({ added: '-29d..' })).toEqual(['Lamp', 'Planter'])
	expect(remount({ added: '..-30d' })).toEqual(['Speaker'])
})

test('date presets apply relative ranges and leaving one keeps its days', () => {
	const onChange = vi.fn()
	const container = mountAdvanced({}, onChange)
	tab(container, 'Filters').click()

	pick(combobox(container, 'Added condition'), 'Last 30 days')
	expect(input(container, 'Added').value).toBe(resolveFilterTableDate('-29d'))
	container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click()
	expect(onChange).toHaveBeenLastCalledWith({ added: '-29d..today' })
	expect(names(container)).toEqual(['Lamp', 'Planter'])
	expect(pillTexts(container)).toEqual(['Added: Last 30 days', 'Clear all'])

	tab(container, 'Filters').click()
	pick(combobox(container, 'Added condition'), 'Custom range')
	container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click()
	expect(onChange).toHaveBeenLastCalledWith({
		added: `${resolveFilterTableDate('-29d')}..${resolveFilterTableDate('today')}`,
	})
})
