import { IconDeviceFloppy, IconSearch, IconX } from '@tabler/icons-solidjs'
import type { Accessor, JSX } from 'solid-js'
import {
	createEffect,
	createMemo,
	createSignal,
	createUniqueId,
	For,
	on,
	Show,
	splitProps,
} from 'solid-js'
import { Combobox, type ComboboxOption } from './combobox'
import { DataTable, type DataTableProps } from './data-table'

export type FilterTableFilterType = 'text' | 'select' | 'boolean'

/** A filter's value: text for `text`/`boolean` (`'true'`/`'false'`), a list for `select`. */
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
	/** Shows the quick search input above the table. Defaults to `true`. */
	quickSearch?: boolean
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
	savedFiltersLabel?: string
	saveLabel?: string
	saveNameLabel?: string
	cancelLabel?: string
	deleteSavedFilterLabel?: string
}

const QUICK_SEARCH_KEY = 'q'

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
		'quickSearch',
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
		'savedFiltersLabel',
		'saveLabel',
		'saveNameLabel',
		'cancelLabel',
		'deleteSavedFilterLabel',
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
		const normalized = normalize(next)
		if (local.filterValues === undefined) setInternalValues(normalized)
		local.onFilterValuesChange?.(normalized)
	}

	function setValue(key: string, value: FilterTableValue): void {
		setValues({ ...values(), [key]: value })
	}

	const quickSearch = () => asText(values()[QUICK_SEARCH_KEY])
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

	const filteredRows = createMemo(() => {
		if (local.manualFiltering) return rows()
		const needle = quickSearch().toLowerCase()
		const applied = appliedFilters()
		return rows().filter(
			(row) =>
				(needle === '' || searchText(row).toLowerCase().includes(needle)) &&
				applied.every((filter) => matches(row, filter, values()[filter.key])),
		)
	})

	function options(filter: FilterTableFilter<TRow>): ComboboxOption[] {
		if (filter.options) return filter.options
		const seen = new Set<string>()
		for (const row of rows()) {
			const value = filterValue(row, filter)
			for (const item of Array.isArray(value) ? value : [value]) {
				const text = asText(item)
				if (text !== '') seen.add(text)
			}
		}
		return [...seen]
			.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
			.map((value) => ({ value, label: value }))
	}

	function optionLabel(filter: FilterTableFilter<TRow>, value: string): string {
		if (filter.type === 'boolean') {
			return value === 'true' ? (local.yesLabel ?? 'Yes') : (local.noLabel ?? 'No')
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
		if (saved) setValues(saved.values)
	}

	function startSaving(): void {
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

	function deleteSaved(name: string): void {
		local.onSavedFiltersChange?.((savedFilters() ?? []).filter((s) => s.name !== name))
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

	function field(filter: FilterTableFilter<TRow>): JSX.Element {
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
		const selected = () => {
			const value = draftValue(filter.key)
			return Array.isArray(value) ? value : []
		}
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
						<For each={selected()}>
							{(value) => (
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
							)}
						</For>
					</ul>
				</Show>
			</div>
		)
	}

	const toolbar = (
		<div class="filter-table-toolbar">
			<Show when={local.quickSearch !== false}>
				<div class="filter-table-search">
					<IconSearch class="filter-table-search-icon" size={16} aria-hidden="true" />
					<input
						type="search"
						class="filter-table-input"
						aria-label={local.quickSearchLabel ?? 'Quick search'}
						placeholder={local.quickSearchLabel ?? 'Quick search'}
						value={quickSearch()}
						onInput={(e) => setValue(QUICK_SEARCH_KEY, e.currentTarget.value)}
					/>
				</div>
			</Show>
			<Show when={(savedFilters()?.length ?? 0) > 0}>
				<div class="filter-table-saved">
					<Combobox
						value={currentSaved()?.name ?? ''}
						onChange={applySaved}
						options={(savedFilters() ?? []).map((s) => ({
							value: s.name,
							label: s.name,
						}))}
						ariaLabel={local.savedFiltersLabel ?? 'Saved filters'}
						placeholder={local.savedFiltersLabel ?? 'Saved filters'}
					/>
					<Show when={currentSaved()}>
						{(saved) => (
							<button
								type="button"
								class="filter-table-chip-remove"
								aria-label={`${local.deleteSavedFilterLabel ?? 'Delete saved filter'} ${saved().name}`}
								onClick={() => deleteSaved(saved().name)}
							>
								<IconX size={14} aria-hidden="true" />
							</button>
						)}
					</Show>
				</div>
			</Show>
			<Show when={pills().length > 0}>
				<ul class="filter-table-pills" aria-label="Applied filters">
					<For each={pills()}>
						{(pill) => (
							<li>
								<button
									type="button"
									class="filter-table-pill"
									aria-label={`Remove filter ${pill.text}`}
									onClick={() => removePill(pill.filter, pill.item)}
								>
									{pill.text}
									<IconX size={12} aria-hidden="true" />
								</button>
							</li>
						)}
					</For>
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
			</Show>
			<Show when={naming() && pills().length > 0}>
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
					<button
						type="button"
						class="filter-table-button"
						onClick={() => setNaming(false)}
					>
						{local.cancelLabel ?? 'Cancel'}
					</button>
				</form>
			</Show>
		</div>
	)

	return (
		<div class={`filter-table${local.class ? ` ${local.class}` : ''}`}>
			<div class="filter-table-tabs" role="tablist">
				<For each={tabs}>
					{(name) => (
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
							{name === 'results'
								? (local.resultsLabel ?? 'Results')
								: (local.filtersLabel ?? 'Filters')}
							<Show when={name === 'results' || appliedFilters().length > 0}>
								<span class="filter-table-badge">
									{name === 'results'
										? filteredRows().length
										: appliedFilters().length}
								</span>
							</Show>
						</button>
					)}
				</For>
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
				<form class="filter-table-form" onSubmit={apply}>
					<For each={groups()}>
						{(group) => (
							<fieldset class="filter-table-fieldset">
								<Show when={group.name}>
									<legend class="filter-table-legend">{group.name}</legend>
								</Show>
								<For each={group.filters}>
									{(filter) => (
										<div class="filter-table-field">
											<label
												class="filter-table-label"
												for={fieldId(filter.key)}
											>
												{filter.label}
											</label>
											{field(filter)}
										</div>
									)}
								</For>
							</fieldset>
						)}
					</For>
					<div class="filter-table-form-actions">
						<button type="button" class="filter-table-button" onClick={reset}>
							<IconX size={16} aria-hidden="true" />
							{local.resetLabel ?? 'Reset'}
						</button>
						<button
							type="submit"
							class="filter-table-button filter-table-button-primary"
						>
							<IconSearch size={16} aria-hidden="true" />
							{local.applyLabel ?? 'Search'}
						</button>
					</div>
				</form>
			</div>
		</div>
	)
}
