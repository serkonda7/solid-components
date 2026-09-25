import type { Accessor, JSX } from 'solid-js'
import {
	createEffect,
	createMemo,
	createSignal,
	createUniqueId,
	For,
	onCleanup,
	Show,
} from 'solid-js'

export type DataTableSortDirection = 'asc' | 'desc'

export interface DataTableSort {
	key: string
	direction: DataTableSortDirection
}

export interface DataTableColumn<TRow> {
	key: string
	label: string
	sortable?: boolean
	sortValue?: (row: TRow) => unknown
	class?: string
	ariaLabel?: string
	getValue?: (row: TRow) => JSX.Element
	/** Whether the column is visible by default when the column customizer is used. Defaults to `true`. */
	defaultVisible?: boolean
	/** Whether the column can be hidden via the column customizer. Defaults to `true`. Non-toggleable columns are always shown. */
	toggleable?: boolean
}

export interface DataTableProps<TRow> {
	rows: TRow[] | Accessor<TRow[]>
	columns: DataTableColumn<TRow>[]
	getRowId: (row: TRow) => string | number
	getCell?: (row: TRow, column: DataTableColumn<TRow>) => JSX.Element
	rowActions?: (row: TRow) => JSX.Element
	selected?: string[] | number[] | Accessor<string[] | number[]>
	onSelectionChange?: (ids: (string | number)[]) => void
	selectionLabel?: string
	sortKey?: string | Accessor<string | undefined>
	sortDirection?: DataTableSortDirection | Accessor<DataTableSortDirection>
	defaultSort?: DataTableSort
	onSort?: (key: string) => void
	onSortClear?: () => void
	onSortChange?: (sort: DataTableSort | undefined) => void
	visibleColumns?: string[] | Accessor<string[]>
	defaultVisibleColumns?: string[]
	onVisibleColumnsChange?: (visibleKeys: string[]) => void
	showColumnCustomizer?: boolean | Accessor<boolean>
	columnCustomizerLabel?: string
	columnCustomizerTitle?: string
	columnCustomizerShowAllLabel?: string
	columnCustomizerResetLabel?: string
	loading?: boolean | Accessor<boolean>
	empty?: boolean | Accessor<boolean>
	loadingContent?: JSX.Element
	emptyContent?: JSX.Element
	class?: string
}

function read<T>(value: T | Accessor<T>): T {
	return typeof value === 'function' ? (value as Accessor<T>)() : value
}

/**
 * Generic accessible data table. Data fetching, navigation, and cell content
 * stay with the consuming app; this component owns table structure and the
 * repeated selection/sort/loading states.
 */
export function DataTable<TRow>(props: DataTableProps<TRow>): JSX.Element {
	const rows = createMemo(() => read(props.rows))
	const loading = () => read(props.loading ?? false)
	const selected = () => read(props.selected ?? [])
	const sortControlled = props.sortKey !== undefined || props.sortDirection !== undefined
	const [internalSort, setInternalSort] = createSignal<DataTableSort | undefined>(
		props.defaultSort,
	)
	const sortKey = () => (sortControlled ? read(props.sortKey ?? undefined) : internalSort()?.key)
	const sortDirection = () =>
		sortControlled ? read(props.sortDirection ?? 'asc') : (internalSort()?.direction ?? 'asc')
	const showCustomizer = () => read(props.showColumnCustomizer ?? false)
	const hasSelection = () => props.selected !== undefined && props.onSelectionChange !== undefined
	const allSelected = () => {
		const ids = selected()
		return (
			rows().length > 0 && rows().every((row) => ids.includes(props.getRowId(row) as never))
		)
	}

	const defaultVisibleKeys = createMemo(
		() =>
			props.defaultVisibleColumns ??
			props.columns
				.filter((column) => column.defaultVisible !== false)
				.map((column) => column.key),
	)
	const [uncontrolledVisible, setUncontrolledVisible] = createSignal<string[] | undefined>(
		undefined,
	)
	const visibleKeys = () =>
		props.visibleColumns !== undefined
			? read(props.visibleColumns)
			: (uncontrolledVisible() ?? defaultVisibleKeys())
	const visibleSet = createMemo(() => new Set(visibleKeys()))
	const visibleColumns = createMemo(() =>
		props.columns.filter(
			(column) => column.toggleable === false || visibleSet().has(column.key),
		),
	)
	const toggleableColumns = createMemo(() =>
		props.columns.filter((column) => column.toggleable !== false),
	)
	const allToggleableKeys = createMemo(() => toggleableColumns().map((column) => column.key))

	function sortValue(row: TRow, column: DataTableColumn<TRow>): unknown {
		if (column.sortValue) return column.sortValue(row)
		return (row as Record<string, unknown>)[column.key]
	}

	function compareSortValues(left: unknown, right: unknown): number {
		if (left === right) return 0
		if (left == null) return -1
		if (right == null) return 1
		if (typeof left === 'number' && typeof right === 'number') return left - right
		return String(left).localeCompare(String(right), undefined, { numeric: true })
	}

	const sortedRows = createMemo(() => {
		const currentRows = rows()
		const key = sortKey()
		if (sortControlled || !key) return currentRows

		const column = props.columns.find((candidate) => candidate.key === key)
		if (!column) return currentRows
		const direction = sortDirection() === 'asc' ? 1 : -1
		return [...currentRows].sort(
			(left, right) =>
				direction * compareSortValues(sortValue(left, column), sortValue(right, column)),
		)
	})

	/** Cycles the clicked column through `asc` → `desc` → unsorted. */
	function changeSort(key: string): void {
		const active = sortKey() === key
		const next: DataTableSort | undefined =
			active && sortDirection() === 'desc'
				? undefined
				: { key, direction: active ? 'desc' : 'asc' }
		if (!sortControlled) setInternalSort(next)
		props.onSort?.(key)
		if (!next) props.onSortClear?.()
		props.onSortChange?.(next)
	}

	function orderKeys(keys: string[]): string[] {
		const order = new Map(props.columns.map((column, index) => [column.key, index] as const))
		return [...keys].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
	}

	function setVisibleKeys(next: string[]): void {
		const ordered = orderKeys(next)
		if (props.visibleColumns === undefined) {
			setUncontrolledVisible(ordered)
		}
		props.onVisibleColumnsChange?.(ordered)
	}

	function toggleColumn(key: string, checked: boolean): void {
		const current = new Set(visibleKeys())
		if (checked) {
			current.add(key)
		} else {
			current.delete(key)
		}
		// Keep keys for unknown/removed columns out of the state; non-toggleable
		// columns stay visible implicitly and are not tracked here.
		const next = allToggleableKeys().filter((candidate) => current.has(candidate))
		// Preserve columns order: `allToggleableKeys` already follows it.
		setVisibleKeys(next)
	}

	function showAllColumns(): void {
		setVisibleKeys(allToggleableKeys())
	}

	function resetColumns(): void {
		setVisibleKeys(defaultVisibleKeys())
	}

	const customizerId = createUniqueId()
	const panelId = `${customizerId}-panel`
	const [customizerOpen, setCustomizerOpen] = createSignal(false)
	let customizerRoot: HTMLDivElement | undefined

	createEffect(() => {
		if (!customizerOpen() || !showCustomizer()) return
		function onPointerDown(event: PointerEvent): void {
			if (customizerRoot && !customizerRoot.contains(event.target as Node)) {
				setCustomizerOpen(false)
			}
		}
		function onKeyDown(event: KeyboardEvent): void {
			if (event.key === 'Escape') setCustomizerOpen(false)
		}
		document.addEventListener('pointerdown', onPointerDown)
		document.addEventListener('keydown', onKeyDown)
		onCleanup(() => {
			document.removeEventListener('pointerdown', onPointerDown)
			document.removeEventListener('keydown', onKeyDown)
		})
	})

	let selectAllRef: HTMLInputElement | undefined
	createEffect(() => {
		if (selectAllRef) {
			selectAllRef.indeterminate = selected().length > 0 && !allSelected()
		}
	})

	function toggleAll(checked: boolean): void {
		props.onSelectionChange?.(checked ? rows().map(props.getRowId) : [])
	}

	function toggleRow(row: TRow, checked: boolean): void {
		const id = props.getRowId(row)
		const ids = selected()
		const next = checked ? [...ids, id] : ids.filter((value) => value !== id)
		props.onSelectionChange?.(next)
	}

	function isSelected(row: TRow): boolean {
		return selected().includes(props.getRowId(row) as never)
	}

	function isColumnVisible(column: DataTableColumn<TRow>): boolean {
		return column.toggleable === false || visibleSet().has(column.key)
	}

	function cell(row: TRow, column: DataTableColumn<TRow>): JSX.Element {
		return props.getCell?.(row, column) ?? column.getValue?.(row) ?? null
	}

	return (
		<div class={`data-table-wrap${props.class ? ` ${props.class}` : ''}`}>
			<Show when={showCustomizer()}>
				<div class="data-table-toolbar">
					<div ref={customizerRoot} class="data-table-customizer">
						<button
							type="button"
							class="data-table-customizer-button"
							aria-haspopup="dialog"
							aria-expanded={customizerOpen()}
							aria-controls={panelId}
							onClick={() => setCustomizerOpen((open) => !open)}
						>
							<span aria-hidden="true">⚙</span>{' '}
							{props.columnCustomizerLabel ?? 'Columns'}
						</button>
						<Show when={customizerOpen()}>
							<div
								id={panelId}
								role="dialog"
								aria-label={props.columnCustomizerTitle ?? 'Customize columns'}
								class="data-table-customizer-panel"
							>
								<p class="data-table-customizer-title">
									{props.columnCustomizerTitle ?? 'Shown columns'}
								</p>
								<ul class="data-table-customizer-list">
									<For each={props.columns}>
										{(column) => (
											<li>
												<label class="data-table-customizer-option">
													<input
														type="checkbox"
														checked={isColumnVisible(column)}
														disabled={column.toggleable === false}
														onChange={(e) =>
															toggleColumn(
																column.key,
																e.currentTarget.checked,
															)
														}
													/>
													{column.ariaLabel ?? column.label}
												</label>
											</li>
										)}
									</For>
								</ul>
								<div class="data-table-customizer-actions">
									<button type="button" onClick={showAllColumns}>
										{props.columnCustomizerShowAllLabel ?? 'Show all'}
									</button>
									<button type="button" onClick={resetColumns}>
										{props.columnCustomizerResetLabel ?? 'Reset'}
									</button>
								</div>
							</div>
						</Show>
					</div>
				</div>
			</Show>
			<div class="data-table-scroll">
				<table class="data-table">
					<thead>
						<tr>
							<Show when={hasSelection()}>
								<th class="data-table-checkbox">
									<span class="data-table-visually-hidden">Select rows</span>
									<input
										ref={selectAllRef}
										type="checkbox"
										aria-label={props.selectionLabel ?? 'Select all rows'}
										checked={allSelected()}
										onChange={(e) => toggleAll(e.currentTarget.checked)}
									/>
								</th>
							</Show>
							<For each={visibleColumns()}>
								{(column) => (
									<th
										class={column.class}
										aria-sort={
											column.sortable
												? sortKey() === column.key
													? sortDirection() === 'asc'
														? 'ascending'
														: 'descending'
													: 'none'
												: undefined
										}
									>
										<Show
											when={
												column.sortable &&
												(!sortControlled ||
													props.onSort ||
													props.onSortChange)
											}
											fallback={column.label}
										>
											<button
												type="button"
												class="data-table-sort"
												onClick={() => changeSort(column.key)}
											>
												{column.label}
												<span
													class="data-table-sort-indicator"
													aria-hidden="true"
												>
													{sortKey() === column.key
														? sortDirection() === 'asc'
															? '▲'
															: '▼'
														: ''}
												</span>
											</button>
										</Show>
									</th>
								)}
							</For>
							<Show when={props.rowActions}>
								<th>Actions</th>
							</Show>
						</tr>
					</thead>
					<tbody>
						<For each={sortedRows()}>
							{(row) => (
								<tr>
									<Show when={hasSelection()}>
										<td class="data-table-checkbox">
											<input
												type="checkbox"
												aria-label={`Select row ${props.getRowId(row)}`}
												checked={isSelected(row)}
												onChange={(e) =>
													toggleRow(row, e.currentTarget.checked)
												}
											/>
										</td>
									</Show>
									<For each={visibleColumns()}>
										{(column) => (
											<td class={column.class}>{cell(row, column)}</td>
										)}
									</For>
									<Show when={props.rowActions}>
										<td>{props.rowActions?.(row)}</td>
									</Show>
								</tr>
							)}
						</For>
					</tbody>
				</table>
			</div>
			<Show when={loading()}>
				{props.loadingContent ?? <p class="data-table-status">Loading…</p>}
			</Show>
			<Show
				when={
					!loading() &&
					(props.empty === undefined ? rows().length === 0 : read(props.empty))
				}
			>
				{props.emptyContent ?? <p class="data-table-status">No results.</p>}
			</Show>
		</div>
	)
}
