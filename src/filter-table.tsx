import { IconDeviceFloppy, IconSearch, IconX } from '@tabler/icons-solidjs'
import {
	type ColumnDef,
	type ColumnFiltersState,
	columnFilteringFeature,
	createFilteredRowModel,
	createTable,
	filterFn_includesString,
	globalFilteringFeature,
	type RowData,
	tableFeatures,
} from '@tanstack/solid-table'
import type { Accessor, JSX } from 'solid-js'
import {
	createEffect,
	createMemo,
	createSignal,
	createUniqueId,
	For,
	on,
	onCleanup,
	Show,
	splitProps,
} from 'solid-js'
import { Combobox, type ComboboxOption } from './combobox'
import { DataTable, type DataTableProps } from './data-table'

export type FilterTableFilterType = 'text' | 'select' | 'boolean' | 'number-range' | 'date-range'

/**
 * A filter's value: text for `text`/`boolean` (`'true'`/`'false'`), a list for
 * `select`, and `min..max` for ranges, with either bound left empty (`10..`, `..20`).
 * Date bounds are `YYYY-MM-DD`. Read ranges with `parseFilterTableRange`.
 */
export type FilterTableValue = string | string[]

/**
 * Applied filters by filter key, plus the quick search under `q`. Inactive
 * filters are omitted, so the record maps directly onto URL query params.
 */
export type FilterTableValues = Record<string, FilterTableValue>

/** A named set of filter values the user saved for reuse. */
export interface FilterTableSavedFilter {
	name: string
	values: FilterTableValues
}

export interface FilterTableFilter<TRow> {
	key: string
	label: string
	type: FilterTableFilterType
	/** Fieldset heading in the filter form; ungrouped filters come first. */
	group?: string
	/** Value matched against; defaults to `row[key]`. May return an array for `select`. */
	getValue?: (row: TRow) => unknown
	/** Replaces the built-in matching for this filter. */
	match?: (row: TRow, value: FilterTableValue) => boolean
	/** Choices of a `select` filter; derived from the row values when omitted. */
	options?: ComboboxOption[]
	placeholder?: string
	/** Formats a range bound in the filter pills; defaults to the raw value. */
	formatValue?: (value: string) => string
}

export interface FilterTableProps<TRow> extends Omit<DataTableProps<TRow>, 'toolbar'> {
	filters: FilterTableFilter<TRow>[]
	/** Controlled applied filters; pair with `onFilterValuesChange`. */
	filterValues?: FilterTableValues | Accessor<FilterTableValues>
	defaultFilterValues?: FilterTableValues
	onFilterValuesChange?: (values: FilterTableValues) => void
	/**
	 * Saved filters, listed in a picker beside the quick search. Passing this
	 * (even `[]`) enables saving: a "Save" pill names the applied filters and
	 * emits the new list through `onSavedFiltersChange`; persisting it is up to you.
	 */
	savedFilters?: FilterTableSavedFilter[] | Accessor<FilterTableSavedFilter[]>
	onSavedFiltersChange?: (savedFilters: FilterTableSavedFilter[]) => void
	/** Pass `rows` through unfiltered, e.g. when the server applies `filterValues`. */
	manualFiltering?: boolean
	/** Results badge count; defaults to `pagination.rowCount`, then the rows shown. */
	totalCount?: number | Accessor<number | undefined>
	/** Shows the quick search input above the table. Defaults to `true`. */
	quickSearch?: boolean
	/** Milliseconds to wait after typing before searching. Defaults to 300 with `manualFiltering`, else 0. */
	quickSearchDebounce?: number
	/** Text matched by the quick search; defaults to the row's column values. */
	getSearchText?: (row: TRow) => string
	quickSearchLabel?: string
	resultsLabel?: string
	filtersLabel?: string
	applyLabel?: string
	resetLabel?: string
	clearAllLabel?: string
	anyLabel?: string
	yesLabel?: string
	noLabel?: string
	fromLabel?: string
	toLabel?: string
	savedFiltersLabel?: string
	saveLabel?: string
	saveNameLabel?: string
	cancelLabel?: string
	clearSavedFilterLabel?: string
}

const QUICK_SEARCH_KEY = 'q'
const DEFAULT_MANUAL_DEBOUNCE = 300
const RANGE_SEPARATOR = '..'
/** Table column holding each row's search text, which is what the quick search filters. */
const SEARCH_COLUMN = '__search__'

const features = tableFeatures({
	columnFilteringFeature,
	globalFilteringFeature,
	filteredRowModel: createFilteredRowModel(),
})

/** Splits a `min..max` filter value; an open bound is `''`. */
export function parseFilterTableRange(value: string): { min: string; max: string } {
	const [min = '', max = ''] = value.split(RANGE_SEPARATOR)
	return { min, max }
}

function formatRange(min: string, max: string): string {
	return min === '' && max === '' ? '' : `${min}${RANGE_SEPARATOR}${max}`
}

function read<T>(value: T | Accessor<T>): T {
	return typeof value === 'function' ? (value as Accessor<T>)() : value
}

function isActive(value: FilterTableValue | undefined): value is FilterTableValue {
	return Array.isArray(value) ? value.length > 0 : (value ?? '').trim() !== ''
}

/** Drops inactive entries and trims text so equal filters compare equal. */
function normalize(values: FilterTableValues): FilterTableValues {
	const next: FilterTableValues = {}
	for (const [key, value] of Object.entries(values)) {
		if (isActive(value)) next[key] = Array.isArray(value) ? value : value.trim()
	}
	return next
}

function sameValues(a: FilterTableValues, b: FilterTableValues): boolean {
	const keys = Object.keys(a)
	return (
		keys.length === Object.keys(b).length &&
		keys.every((key) => {
			const x = a[key]
			const y = b[key]
			return Array.isArray(x) && Array.isArray(y)
				? x.length === y.length && x.every((v) => y.includes(v))
				: x === y
		})
	)
}

function asText(value: unknown): string {
	return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
		? String(value)
		: ''
}

/** The local `YYYY-MM-DD` day of a date value, which sorts as text. */
function toDay(value: unknown): string | undefined {
	if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
	if (!(value instanceof Date || typeof value === 'string' || typeof value === 'number')) {
		return undefined
	}
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return undefined
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${date.getFullYear()}-${month}-${day}`
}

function inNumberRange(value: unknown, min: string, max: string): boolean {
	if (value == null || value === '') return false
	const number = Number(value)
	if (Number.isNaN(number)) return false
	return (min === '' || number >= Number(min)) && (max === '' || number <= Number(max))
}

function inDateRange(value: unknown, min: string, max: string): boolean {
	const day = toDay(value)
	return day !== undefined && (min === '' || day >= min) && (max === '' || day <= max)
}

/**
 * `DataTable` with filtering: a Results tab with a quick search and
 * removable pills for the applied filters, and a Filters tab with a grouped form
 * that is applied on submit.
 */
export function FilterTable<TRow>(props: FilterTableProps<TRow>): JSX.Element {
	const [local, tableProps] = splitProps(props, [
		'rows',
		'filters',
		'filterValues',
		'defaultFilterValues',
		'onFilterValuesChange',
		'savedFilters',
		'onSavedFiltersChange',
		'manualFiltering',
		'totalCount',
		'quickSearch',
		'quickSearchDebounce',
		'getSearchText',
		'quickSearchLabel',
		'resultsLabel',
		'filtersLabel',
		'applyLabel',
		'resetLabel',
		'clearAllLabel',
		'anyLabel',
		'yesLabel',
		'noLabel',
		'fromLabel',
		'toLabel',
		'savedFiltersLabel',
		'saveLabel',
		'saveNameLabel',
		'cancelLabel',
		'clearSavedFilterLabel',
		'class',
	])
	const rows = createMemo(() => read(local.rows))
	const [internalValues, setInternalValues] = createSignal<FilterTableValues>(
		normalize(local.defaultFilterValues ?? {}),
	)
	const values = createMemo(() =>
		local.filterValues !== undefined ? normalize(read(local.filterValues)) : internalValues(),
	)

	function setValues(next: FilterTableValues): void {
		// A change made while a search is pending must not drop the typed text.
		const pending = searchTimer !== undefined
		cancelSearch()
		const normalized = normalize(
			pending ? { ...next, [QUICK_SEARCH_KEY]: searchInput() } : next,
		)
		if (local.filterValues === undefined) setInternalValues(normalized)
		local.onFilterValuesChange?.(normalized)
	}

	function setValue(key: string, value: FilterTableValue): void {
		setValues({ ...values(), [key]: value })
	}

	const quickSearch = () => asText(values()[QUICK_SEARCH_KEY])
	// The input's text, which runs ahead of the applied search while debouncing.
	const [searchInput, setSearchInput] = createSignal(quickSearch())
	let searchTimer: ReturnType<typeof setTimeout> | undefined

	function cancelSearch(): void {
		clearTimeout(searchTimer)
		searchTimer = undefined
	}
	onCleanup(cancelSearch)

	function commitSearch(): void {
		if (searchInput().trim() !== quickSearch()) setValue(QUICK_SEARCH_KEY, searchInput())
	}

	function flushSearch(): void {
		if (searchTimer === undefined) return
		cancelSearch()
		commitSearch()
	}

	function onSearchInput(text: string): void {
		setSearchInput(text)
		cancelSearch()
		const delay =
			local.quickSearchDebounce ?? (local.manualFiltering ? DEFAULT_MANUAL_DEBOUNCE : 0)
		if (delay <= 0) {
			commitSearch()
			return
		}
		searchTimer = setTimeout(() => {
			searchTimer = undefined
			commitSearch()
		}, delay)
	}

	createEffect(
		on(quickSearch, (applied) => {
			if (searchTimer === undefined && applied !== searchInput().trim())
				setSearchInput(applied)
		}),
	)

	const appliedFilters = createMemo(() => local.filters.filter((f) => isActive(values()[f.key])))

	function filterValue(row: TRow, filter: FilterTableFilter<TRow>): unknown {
		return filter.getValue ? filter.getValue(row) : (row as Record<string, unknown>)[filter.key]
	}

	function matches(row: TRow, filter: FilterTableFilter<TRow>, value: FilterTableValue): boolean {
		if (filter.match) return filter.match(row, value)
		const actual = filterValue(row, filter)
		if (filter.type === 'select') {
			const wanted = Array.isArray(value) ? value : [value]
			const candidates = Array.isArray(actual) ? actual : [actual]
			return candidates.some((candidate) => wanted.includes(asText(candidate)))
		}
		if (filter.type === 'boolean') return Boolean(actual) === (value === 'true')
		if (filter.type === 'number-range' || filter.type === 'date-range') {
			const { min, max } = parseFilterTableRange(asText(value))
			const inRange = filter.type === 'date-range' ? inDateRange : inNumberRange
			return inRange(actual, min, max)
		}
		return asText(actual).toLowerCase().includes(asText(value).toLowerCase())
	}

	function searchText(row: TRow): string {
		if (local.getSearchText) return local.getSearchText(row)
		return tableProps.columns
			.map((column) =>
				asText(column.sortValue?.(row) ?? (row as Record<string, unknown>)[column.key]),
			)
			.join(' ')
	}

	const columnFilters = createMemo<ColumnFiltersState>(() =>
		appliedFilters().map((filter) => ({ id: filter.key, value: values()[filter.key] })),
	)
	// Public row types stay unconstrained; TanStack only requires object rows.
	type TableRow = TRow & RowData
	const columnDefs = createMemo(() => {
		const columns: ColumnDef<typeof features, TableRow>[] = local.filters.map((filter) => ({
			id: filter.key,
			accessorFn: (row) => filterValue(row, filter),
			filterFn: (row, _id, value) => matches(row.original, filter, value),
		}))
		columns.push({ id: SEARCH_COLUMN, accessorFn: searchText })
		return columns
	})

	const table = createTable<typeof features, TableRow>({
		features,
		get data() {
			return rows() as TableRow[]
		},
		get columns() {
			return columnDefs()
		},
		getRowId: (row) => String(tableProps.getRowId(row)),
		get manualFiltering() {
			return local.manualFiltering
		},
		globalFilterFn: filterFn_includesString,
		getColumnCanGlobalFilter: (column) => column.id === SEARCH_COLUMN,
		state: {
			get columnFilters() {
				return columnFilters()
			},
			get globalFilter() {
				return quickSearch()
			},
		},
	})

	const filteredRows = createMemo(() => table.getRowModel().rows.map((row) => row.original))

	/** Sorted row values by `select` filter. Manually filtered rows are only a subset, so these accumulate. */
	const derivedOptions = createMemo((previous: Map<string, string[]>) => {
		const next = new Map<string, string[]>()
		for (const filter of local.filters) {
			if (filter.type !== 'select' || filter.options) continue
			const seen = new Set(local.manualFiltering ? previous.get(filter.key) : undefined)
			for (const row of rows()) {
				const value = filterValue(row, filter)
				for (const item of Array.isArray(value) ? value : [value]) {
					const text = asText(item)
					if (text !== '') seen.add(text)
				}
			}
			next.set(
				filter.key,
				[...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
			)
		}
		return next
	}, new Map())

	function options(filter: FilterTableFilter<TRow>): ComboboxOption[] {
		if (filter.options) return filter.options
		return (derivedOptions().get(filter.key) ?? []).map((value) => ({ value, label: value }))
	}

	function rangeLabel(filter: FilterTableFilter<TRow>, value: string): string {
		const format = filter.formatValue ?? ((bound: string) => bound)
		const { min, max } = parseFilterTableRange(value)
		if (max === '') return `≥ ${format(min)}`
		if (min === '') return `≤ ${format(max)}`
		return `${format(min)} – ${format(max)}`
	}

	function optionLabel(filter: FilterTableFilter<TRow>, value: string): string {
		if (filter.type === 'boolean') {
			return value === 'true' ? (local.yesLabel ?? 'Yes') : (local.noLabel ?? 'No')
		}
		if (filter.type === 'number-range' || filter.type === 'date-range') {
			return rangeLabel(filter, value)
		}
		if (filter.type !== 'select') return value
		return options(filter).find((option) => String(option.value) === value)?.label ?? value
	}

	/** One pill per selected `select` value, one per other filter. */
	const pills = createMemo(() =>
		appliedFilters().flatMap((filter) => {
			const value = values()[filter.key]
			const items = Array.isArray(value) ? value : [value]
			return items.map((item) => ({
				filter,
				item,
				text: `${filter.label}: ${optionLabel(filter, item)}`,
			}))
		}),
	)

	function removePill(filter: FilterTableFilter<TRow>, item: string): void {
		const value = values()[filter.key]
		setValue(filter.key, Array.isArray(value) ? value.filter((v) => v !== item) : '')
	}

	function clearFilters(): void {
		setValues({ [QUICK_SEARCH_KEY]: quickSearch() })
	}

	const savedFilters = createMemo(() =>
		local.savedFilters !== undefined ? read(local.savedFilters) : undefined,
	)
	/** The saved filter equal to the applied values, shown as the picker's selection. */
	const currentSaved = createMemo(() =>
		savedFilters()?.find((saved) => sameValues(normalize(saved.values), values())),
	)
	const [naming, setNaming] = createSignal(false)
	const [savedName, setSavedName] = createSignal('')

	function applySaved(name: string): void {
		const saved = savedFilters()?.find((s) => s.name === name)
		if (!saved) return
		cancelSearch()
		setSearchInput(asText(saved.values[QUICK_SEARCH_KEY]))
		setValues(saved.values)
	}

	function startSaving(): void {
		flushSearch()
		setSavedName(currentSaved()?.name ?? '')
		setNaming(true)
	}

	/** Saves the applied values, replacing a saved filter of the same name. */
	function save(event: SubmitEvent): void {
		event.preventDefault()
		const name = savedName().trim()
		if (name === '') return
		const others = (savedFilters() ?? []).filter((s) => s.name !== name)
		local.onSavedFiltersChange?.([...others, { name, values: values() }])
		setNaming(false)
	}

	// The form edits a draft that is applied on submit.
	const [draft, setDraft] = createSignal<FilterTableValues>(values())
	createEffect(on(values, (applied) => setDraft(applied)))

	function draftValue(key: string): FilterTableValue | undefined {
		return draft()[key]
	}

	function setDraftValue(key: string, value: FilterTableValue): void {
		setDraft((current) => ({ ...current, [key]: value }))
	}

	const groups = createMemo(() => {
		const byGroup = new Map<string | undefined, FilterTableFilter<TRow>[]>([[undefined, []]])
		for (const filter of local.filters) {
			byGroup.set(filter.group, [...(byGroup.get(filter.group) ?? []), filter])
		}
		return [...byGroup.entries()]
			.filter(([, filters]) => filters.length > 0)
			.map(([name, filters]) => ({ name, filters }))
	})

	const id = createUniqueId()
	const tabs = ['results', 'filters'] as const
	type Tab = (typeof tabs)[number]
	const [tab, setTab] = createSignal<Tab>('results')
	const tabId = (name: Tab) => `${id}-tab-${name}`
	const panelId = (name: Tab) => `${id}-panel-${name}`
	const fieldId = (key: string) => `${id}-filter-${key}`

	function selectTab(name: Tab): void {
		if (name === 'filters') setDraft(values())
		setTab(name)
	}

	function onTabKeyDown(event: KeyboardEvent): void {
		const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
		if (delta === 0) return
		event.preventDefault()
		const next = tabs[(tabs.indexOf(tab()) + delta + tabs.length) % tabs.length]
		selectTab(next)
		document.getElementById(tabId(next))?.focus()
	}

	function apply(event: SubmitEvent): void {
		event.preventDefault()
		setValues(draft())
		setTab('results')
	}

	function reset(): void {
		clearFilters()
		setTab('results')
	}

	function multiField(filter: FilterTableFilter<TRow>): JSX.Element {
		const selected = () => {
			const value = draftValue(filter.key)
			return Array.isArray(value) ? value : []
		}
		const chip = (value: string): JSX.Element => (
			<li class="filter-table-chip">
				{optionLabel(filter, value)}
				<button
					type="button"
					class="filter-table-chip-remove"
					aria-label={`Remove ${optionLabel(filter, value)}`}
					onClick={() =>
						setDraftValue(
							filter.key,
							selected().filter((v) => v !== value),
						)
					}
				>
					<IconX size={12} aria-hidden="true" />
				</button>
			</li>
		)
		return (
			<div class="filter-table-multi">
				<Combobox
					id={fieldId(filter.key)}
					value=""
					onChange={(value) => setDraftValue(filter.key, [...selected(), value])}
					options={options(filter).filter(
						(option) => !selected().includes(String(option.value)),
					)}
					placeholder={filter.placeholder ?? local.anyLabel ?? 'Any'}
				/>
				<Show when={selected().length > 0}>
					<ul class="filter-table-chips">
						<For each={selected()}>{chip}</For>
					</ul>
				</Show>
			</div>
		)
	}

	function rangeField(filter: FilterTableFilter<TRow>): JSX.Element {
		const type = filter.type === 'date-range' ? 'date' : 'number'
		const range = () => parseFilterTableRange(asText(draftValue(filter.key)))
		// Memos: rewriting a number input's value would wipe a partial entry like `-`.
		const min = createMemo(() => range().min)
		const max = createMemo(() => range().max)
		const fromLabel = () => local.fromLabel ?? 'From'
		const toLabel = () => local.toLabel ?? 'To'
		return (
			<div class="filter-table-range">
				<input
					id={fieldId(filter.key)}
					class="filter-table-input"
					type={type}
					step="any"
					max={max() || undefined}
					aria-label={`${filter.label} ${fromLabel()}`}
					placeholder={fromLabel()}
					value={min()}
					onInput={(e) =>
						setDraftValue(filter.key, formatRange(e.currentTarget.value, max()))
					}
				/>
				<input
					class="filter-table-input"
					type={type}
					step="any"
					min={min() || undefined}
					aria-label={`${filter.label} ${toLabel()}`}
					placeholder={toLabel()}
					value={max()}
					onInput={(e) =>
						setDraftValue(filter.key, formatRange(min(), e.currentTarget.value))
					}
				/>
			</div>
		)
	}

	function field(filter: FilterTableFilter<TRow>): JSX.Element {
		if (filter.type === 'number-range' || filter.type === 'date-range') {
			return rangeField(filter)
		}
		if (filter.type === 'text') {
			return (
				<input
					id={fieldId(filter.key)}
					class="filter-table-input"
					type="text"
					placeholder={filter.placeholder}
					value={asText(draftValue(filter.key))}
					onInput={(e) => setDraftValue(filter.key, e.currentTarget.value)}
				/>
			)
		}
		if (filter.type === 'boolean') {
			return (
				<Combobox
					id={fieldId(filter.key)}
					value={asText(draftValue(filter.key))}
					onChange={(value) => setDraftValue(filter.key, value)}
					emptyLabel={local.anyLabel ?? 'Any'}
					options={[
						{ value: 'true', label: local.yesLabel ?? 'Yes' },
						{ value: 'false', label: local.noLabel ?? 'No' },
					]}
				/>
			)
		}
		return multiField(filter)
	}

	function quickSearchBox(): JSX.Element {
		return (
			<div class="filter-table-search">
				<IconSearch class="filter-table-search-icon" size={16} aria-hidden="true" />
				<input
					type="search"
					class="filter-table-input"
					aria-label={local.quickSearchLabel ?? 'Quick search'}
					placeholder={local.quickSearchLabel ?? 'Quick search'}
					value={searchInput()}
					onInput={(e) => onSearchInput(e.currentTarget.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter') flushSearch()
					}}
				/>
			</div>
		)
	}

	function savedPicker(): JSX.Element {
		return (
			<div class="filter-table-saved">
				<Combobox
					value={currentSaved()?.name ?? ''}
					onChange={applySaved}
					options={(savedFilters() ?? []).map((s) => ({ value: s.name, label: s.name }))}
					ariaLabel={local.savedFiltersLabel ?? 'Saved filters'}
					placeholder={local.savedFiltersLabel ?? 'Saved filters'}
				/>
				<Show when={currentSaved()}>
					{(saved) => (
						<button
							type="button"
							class="filter-table-chip-remove"
							aria-label={`${local.clearSavedFilterLabel ?? 'Clear saved filter'} ${saved().name}`}
							onClick={clearFilters}
						>
							<IconX size={14} aria-hidden="true" />
						</button>
					)}
				</Show>
			</div>
		)
	}

	function pill(item: { filter: FilterTableFilter<TRow>; item: string; text: string }) {
		return (
			<li>
				<button
					type="button"
					class="filter-table-pill"
					aria-label={`Remove filter ${item.text}`}
					onClick={() => removePill(item.filter, item.item)}
				>
					{item.text}
					<IconX size={12} aria-hidden="true" />
				</button>
			</li>
		)
	}

	function pillList(): JSX.Element {
		return (
			<ul class="filter-table-pills" aria-label="Applied filters">
				<For each={pills()}>{pill}</For>
				<li>
					<button
						type="button"
						class="filter-table-pill filter-table-pill-clear"
						onClick={clearFilters}
					>
						{local.clearAllLabel ?? 'Clear all'}
					</button>
				</li>
				<Show when={savedFilters() !== undefined && !naming()}>
					<li>
						<button
							type="button"
							class="filter-table-pill filter-table-pill-save"
							onClick={startSaving}
						>
							<IconDeviceFloppy size={12} aria-hidden="true" />
							{local.saveLabel ?? 'Save'}
						</button>
					</li>
				</Show>
			</ul>
		)
	}

	function saveForm(): JSX.Element {
		return (
			<form
				class="filter-table-save"
				onSubmit={save}
				onKeyDown={(e) => {
					if (e.key === 'Escape') setNaming(false)
				}}
			>
				<input
					ref={(el) => queueMicrotask(() => el.focus())}
					type="text"
					class="filter-table-input"
					aria-label={local.saveNameLabel ?? 'Filter name'}
					placeholder={local.saveNameLabel ?? 'Filter name'}
					value={savedName()}
					onInput={(e) => setSavedName(e.currentTarget.value)}
				/>
				<button type="submit" class="filter-table-button filter-table-button-primary">
					<IconDeviceFloppy size={16} aria-hidden="true" />
					{local.saveLabel ?? 'Save'}
				</button>
				<button type="button" class="filter-table-button" onClick={() => setNaming(false)}>
					{local.cancelLabel ?? 'Cancel'}
				</button>
			</form>
		)
	}

	const toolbar = (
		<div class="filter-table-toolbar">
			<Show when={local.quickSearch !== false}>{quickSearchBox()}</Show>
			<Show when={(savedFilters()?.length ?? 0) > 0}>{savedPicker()}</Show>
			<Show when={pills().length > 0}>{pillList()}</Show>
			<Show when={naming() && pills().length > 0}>{saveForm()}</Show>
		</div>
	)

	function tabLabel(name: Tab): string {
		return name === 'results'
			? (local.resultsLabel ?? 'Results')
			: (local.filtersLabel ?? 'Filters')
	}

	function tabCount(name: Tab): number {
		if (name !== 'results') return appliedFilters().length
		return (
			read(local.totalCount) ?? read(tableProps.pagination)?.rowCount ?? filteredRows().length
		)
	}

	function tabButton(name: Tab): JSX.Element {
		return (
			<button
				type="button"
				role="tab"
				id={tabId(name)}
				class="filter-table-tab"
				aria-selected={tab() === name}
				aria-controls={panelId(name)}
				tabIndex={tab() === name ? 0 : -1}
				onClick={() => selectTab(name)}
				onKeyDown={onTabKeyDown}
			>
				{tabLabel(name)}
				<Show when={name === 'results' || appliedFilters().length > 0}>
					<span class="filter-table-badge">{tabCount(name)}</span>
				</Show>
			</button>
		)
	}

	function fieldRow(filter: FilterTableFilter<TRow>): JSX.Element {
		return (
			<div class="filter-table-field">
				<label class="filter-table-label" for={fieldId(filter.key)}>
					{filter.label}
				</label>
				{field(filter)}
			</div>
		)
	}

	function fieldset(group: { name: string | undefined; filters: FilterTableFilter<TRow>[] }) {
		return (
			<fieldset class="filter-table-fieldset">
				<Show when={group.name}>
					<legend class="filter-table-legend">{group.name}</legend>
				</Show>
				<For each={group.filters}>{fieldRow}</For>
			</fieldset>
		)
	}

	function filterForm(): JSX.Element {
		return (
			<form class="filter-table-form" onSubmit={apply}>
				<For each={groups()}>{fieldset}</For>
				<div class="filter-table-form-actions">
					<button type="button" class="filter-table-button" onClick={reset}>
						<IconX size={16} aria-hidden="true" />
						{local.resetLabel ?? 'Reset'}
					</button>
					<button type="submit" class="filter-table-button filter-table-button-primary">
						<IconSearch size={16} aria-hidden="true" />
						{local.applyLabel ?? 'Search'}
					</button>
				</div>
			</form>
		)
	}

	return (
		<div class={`filter-table${local.class ? ` ${local.class}` : ''}`}>
			<div class="filter-table-tabs" role="tablist">
				<For each={tabs}>{tabButton}</For>
			</div>
			{/* Both panels stay mounted so the table keeps its sort and column state. */}
			<div
				id={panelId('results')}
				role="tabpanel"
				aria-labelledby={tabId('results')}
				hidden={tab() !== 'results'}
			>
				<DataTable {...tableProps} rows={filteredRows} toolbar={toolbar} />
			</div>
			<div
				id={panelId('filters')}
				role="tabpanel"
				aria-labelledby={tabId('filters')}
				hidden={tab() !== 'filters'}
			>
				{filterForm()}
			</div>
		</div>
	)
}
