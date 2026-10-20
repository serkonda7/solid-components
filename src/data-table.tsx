import { IconMenu } from '@tabler/icons-solidjs'
import type { Accessor, JSX } from 'solid-js'
import {
	children,
	createEffect,
	createMemo,
	createSignal,
	createUniqueId,
	For,
	onCleanup,
	Show,
	untrack,
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
	/** Column width: a number (px) or any CSS length, e.g. `'12rem'` or `'20%'`. */
	width?: number | string
	/** Minimum column width: a number (px) or any CSS length. */
	minWidth?: number | string
	/** Maximum column width: a number (px) or any CSS length. */
	maxWidth?: number | string
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
	sortKey?: string | Accessor<string | undefined>
	sortDirection?: DataTableSortDirection | Accessor<DataTableSortDirection>
	defaultSort?: DataTableSort
	onSort?: (key: string) => void
	onSortClear?: () => void
	onSortChange?: (sort: DataTableSort | undefined) => void
	visibleColumns?: string[] | Accessor<string[]>
	defaultVisibleColumns?: string[]
	onVisibleColumnsChange?: (visibleKeys: string[]) => void
	/** Controlled column order as column keys; pair with `onColumnOrderChange`. */
	columnOrder?: string[] | Accessor<string[]>
	defaultColumnOrder?: string[]
	onColumnOrderChange?: (orderedKeys: string[]) => void
	/** Shows a drag handle between column headers to resize columns. */
	resizableColumns?: boolean
	/** Called with all current pixel widths (by column key) after a resize. */
	onColumnWidthsChange?: (widths: Record<string, number>) => void
	showColumnCustomizer?: boolean | Accessor<boolean>
	columnCustomizerLabel?: string
	columnCustomizerTitle?: string
	columnCustomizerShowAllLabel?: string
	columnCustomizerResetLabel?: string
	/** Content rendered at the start of the toolbar, before the column customizer. */
	toolbar?: JSX.Element
	loading?: boolean | Accessor<boolean>
	empty?: boolean | Accessor<boolean>
	loadingContent?: JSX.Element
	emptyContent?: JSX.Element
	class?: string
}

function read<T>(value: T | Accessor<T>): T {
	return typeof value === 'function' ? (value as Accessor<T>)() : value
}

function columnStyle<TRow>(
	column: DataTableColumn<TRow>,
	override?: number,
): JSX.CSSProperties | undefined {
	if (override !== undefined) {
		return {
			width: `${override}px`,
			'min-width': `${override}px`,
			'max-width': `${override}px`,
		}
	}
	const size = (value: number | string | undefined) =>
		typeof value === 'number' ? `${value}px` : value
	const style: JSX.CSSProperties = {}
	if (column.width !== undefined) style.width = size(column.width)
	if (column.minWidth !== undefined) style['min-width'] = size(column.minWidth)
	if (column.maxWidth !== undefined) style['max-width'] = size(column.maxWidth)
	return Object.keys(style).length > 0 ? style : undefined
}

/**
 * Generic accessible data table. Data fetching, navigation, and cell content
 * stay with the consuming app; this component owns table structure and the
 * repeated sort/loading states.
 */
export function DataTable<TRow>(props: DataTableProps<TRow>): JSX.Element {
	const rows = createMemo(() => read(props.rows))
	const loading = () => read(props.loading ?? false)
	const sortControlled = props.sortKey !== undefined || props.sortDirection !== undefined
	const [internalSort, setInternalSort] = createSignal<DataTableSort | undefined>(
		props.defaultSort,
	)
	const sortKey = () => (sortControlled ? read(props.sortKey ?? undefined) : internalSort()?.key)
	const sortDirection = () =>
		sortControlled ? read(props.sortDirection ?? 'asc') : (internalSort()?.direction ?? 'asc')
	const showCustomizer = () => read(props.showColumnCustomizer ?? false)
	const toolbar = children(() => props.toolbar)

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

	const [uncontrolledOrder, setUncontrolledOrder] = createSignal<string[] | undefined>(undefined)
	/** Columns sorted by `keys`; unknown keys are dropped, unlisted columns appended. */
	function columnsInOrder(keys: string[]): DataTableColumn<TRow>[] {
		const byKey = new Map(props.columns.map((column) => [column.key, column] as const))
		const ordered = [...new Set(keys)].flatMap((key) => byKey.get(key) ?? [])
		const placed = new Set(ordered)
		return [...ordered, ...props.columns.filter((column) => !placed.has(column))]
	}
	const orderedColumns = createMemo(() =>
		columnsInOrder(
			props.columnOrder !== undefined
				? read(props.columnOrder)
				: (uncontrolledOrder() ?? props.defaultColumnOrder ?? []),
		),
	)
	const visibleColumns = createMemo(() =>
		orderedColumns().filter(
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

	function setColumnOrder(next: string[]): void {
		if (props.columnOrder === undefined) setUncontrolledOrder(next)
		props.onColumnOrderChange?.(next)
	}

	/** Moves the column with `key` to `index` within the current order. */
	function moveColumn(key: string, index: number): void {
		const keys = orderedColumns().map((column) => column.key)
		const from = keys.indexOf(key)
		if (from === -1 || index < 0 || index >= keys.length || index === from) return
		keys.splice(from, 1)
		keys.splice(index, 0, key)
		setColumnOrder(keys)
	}

	function resetColumns(): void {
		setVisibleKeys(defaultVisibleKeys())
		setColumnOrder(columnsInOrder(props.defaultColumnOrder ?? []).map((column) => column.key))
	}

	const MIN_COLUMN_WIDTH = 40
	const [widths, setWidths] = createSignal<Record<string, number>>({})
	const [tableWidth, setTableWidth] = createSignal<number | undefined>()
	let tableRef: HTMLTableElement | undefined

	createEffect(() => {
		const keys = visibleColumns().map((column) => column.key)
		if (!tableRef || untrack(tableWidth) === undefined) return
		const current = untrack(widths)
		if (keys.every((key) => current[key] !== undefined)) return
		const next = { ...current }
		for (const key of keys) {
			if (next[key] !== undefined) continue
			const header = tableRef.querySelector<HTMLElement>(`th[data-column-key="${key}"]`)
			const index = header
				? Array.prototype.indexOf.call(header.parentElement?.children, header)
				: -1
			let fit = 0
			for (const row of tableRef.rows) {
				const cell = row.cells[index]
				if (cell) fit = Math.max(fit, cell.scrollWidth)
			}
			next[key] = Math.max(MIN_COLUMN_WIDTH, Math.ceil(fit))
		}
		setWidths(next)
		const extra = [...tableRef.querySelectorAll<HTMLElement>('thead th:not([data-column-key])')]
		setTableWidth(
			keys.reduce((sum, key) => sum + (next[key] ?? 0), 0) +
				extra.reduce((sum, th) => sum + th.getBoundingClientRect().width, 0),
		)
	})

	function startResize(event: PointerEvent, key: string): void {
		if (!tableRef) return
		event.preventDefault()
		event.stopPropagation()
		const handle = event.currentTarget as HTMLElement
		handle.setPointerCapture(event.pointerId)
		const startX = event.clientX
		const startTable = tableRef.getBoundingClientRect().width
		const frozen: Record<string, number> = {}
		for (const th of tableRef.querySelectorAll<HTMLElement>('th[data-column-key]')) {
			frozen[th.dataset.columnKey as string] = th.getBoundingClientRect().width
		}
		const startWidth = frozen[key] ?? MIN_COLUMN_WIDTH
		let moved = false

		function onMove(e: PointerEvent): void {
			if (!moved && Math.abs(e.clientX - startX) < 2) return
			moved = true
			const next = Math.max(MIN_COLUMN_WIDTH, startWidth + e.clientX - startX)
			setWidths({ ...frozen, [key]: next })
			setTableWidth(startTable + next - startWidth)
		}
		function onUp(): void {
			handle.removeEventListener('pointermove', onMove)
			handle.removeEventListener('pointerup', onUp)
			handle.removeEventListener('pointercancel', onUp)
			if (moved) props.onColumnWidthsChange?.(widths())
		}
		handle.addEventListener('pointermove', onMove)
		handle.addEventListener('pointerup', onUp)
		handle.addEventListener('pointercancel', onUp)
	}

	function resizeByKey(event: KeyboardEvent, key: string): void {
		const step = event.key === 'ArrowLeft' ? -10 : event.key === 'ArrowRight' ? 10 : 0
		if (!step || !tableRef) return
		event.preventDefault()
		const frozen: Record<string, number> = {}
		for (const th of tableRef.querySelectorAll<HTMLElement>('th[data-column-key]')) {
			frozen[th.dataset.columnKey as string] = th.getBoundingClientRect().width
		}
		const current = frozen[key] ?? MIN_COLUMN_WIDTH
		const next = Math.max(MIN_COLUMN_WIDTH, current + step)
		setTableWidth(tableRef.getBoundingClientRect().width + next - current)
		setWidths({ ...frozen, [key]: next })
		props.onColumnWidthsChange?.(widths())
	}

	const [draggedKey, setDraggedKey] = createSignal<string | undefined>()

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

	function isColumnVisible(column: DataTableColumn<TRow>): boolean {
		return column.toggleable === false || visibleSet().has(column.key)
	}

	function cell(row: TRow, column: DataTableColumn<TRow>): JSX.Element {
		return props.getCell?.(row, column) ?? column.getValue?.(row) ?? null
	}

	return (
		<div class={`data-table-wrap${props.class ? ` ${props.class}` : ''}`}>
			<Show when={showCustomizer() || toolbar.toArray().length > 0}>
				<div class="data-table-toolbar">
					<Show when={toolbar.toArray().length > 0}>
						<div class="data-table-toolbar-start">{toolbar()}</div>
					</Show>
					<Show when={showCustomizer()}>
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
										<For each={orderedColumns()}>
											{(column, index) => (
												<li
													class="data-table-customizer-item"
													classList={{
														'data-table-customizer-item-dragging':
															draggedKey() === column.key,
													}}
													draggable="true"
													onDragStart={(e) => {
														setDraggedKey(column.key)
														e.dataTransfer?.setData(
															'text/plain',
															column.key,
														)
														if (e.dataTransfer) {
															e.dataTransfer.effectAllowed = 'move'
														}
													}}
													onDragOver={(e) => {
														const key = draggedKey()
														if (key === undefined) return
														e.preventDefault()
														moveColumn(key, index())
													}}
													onDrop={(e) => e.preventDefault()}
													onDragEnd={() => setDraggedKey(undefined)}
												>
													<IconMenu
														class="data-table-customizer-grip"
														size={14}
														aria-hidden="true"
													/>
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
					</Show>
				</div>
			</Show>
			<div class="data-table-scroll">
				<table
					ref={tableRef}
					class="data-table"
					classList={{ 'data-table-resized': tableWidth() !== undefined }}
					style={tableWidth() !== undefined ? { width: `${tableWidth()}px` } : undefined}
				>
					<thead>
						<tr>
							<For each={visibleColumns()}>
								{(column) => (
									<th
										class={column.class}
										data-column-key={column.key}
										style={columnStyle(column, widths()[column.key])}
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
										<Show when={props.resizableColumns}>
											<span
												class="data-table-resize-handle"
												role="separator"
												aria-orientation="vertical"
												aria-label={`Resize ${column.ariaLabel ?? column.label}`}
												tabindex="0"
												onPointerDown={(e) => startResize(e, column.key)}
												onKeyDown={(e) => resizeByKey(e, column.key)}
											/>
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
									<For each={visibleColumns()}>
										{(column) => (
											<td
												class={column.class}
												style={columnStyle(column, widths()[column.key])}
											>
												{cell(row, column)}
											</td>
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
