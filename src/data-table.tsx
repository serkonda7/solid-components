import { IconMenu } from '@tabler/icons-solidjs'
import {
	type ColumnDef,
	type ColumnSizingState,
	type ColumnVisibilityState,
	columnOrderingFeature,
	columnSizingFeature,
	columnVisibilityFeature,
	createSortedRowModel,
	createTable,
	functionalUpdate,
	type RowData,
	rowSortingFeature,
	type SortingState,
	tableFeatures,
	type Updater,
} from '@tanstack/solid-table'
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

const MIN_COLUMN_WIDTH = 40

const features = tableFeatures({
	rowSortingFeature,
	sortedRowModel: createSortedRowModel(),
	columnVisibilityFeature,
	columnOrderingFeature,
	columnSizingFeature,
})

function compareSortValues(left: unknown, right: unknown): number {
	if (left === right) return 0
	if (left == null) return -1
	if (right == null) return 1
	if (typeof left === 'number' && typeof right === 'number') return left - right
	return String(left).localeCompare(String(right), undefined, { numeric: true })
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
	const columnVisibility = createMemo<ColumnVisibilityState>(() => {
		const visible = new Set(visibleKeys())
		return Object.fromEntries(
			props.columns.map((column) => [
				column.key,
				column.toggleable === false || visible.has(column.key),
			]),
		)
	})

	const [uncontrolledOrder, setUncontrolledOrder] = createSignal<string[] | undefined>(undefined)
	const columnOrder = () =>
		props.columnOrder !== undefined
			? read(props.columnOrder)
			: (uncontrolledOrder() ?? props.defaultColumnOrder ?? [])
	const sorting = createMemo<SortingState>(() => {
		const key = sortKey()
		return key === undefined ? [] : [{ id: key, desc: sortDirection() === 'desc' }]
	})
	// Public row types stay unconstrained; TanStack only requires object rows.
	type TableRow = TRow & RowData
	const columnDefs = createMemo(() =>
		props.columns.map(
			(column): ColumnDef<typeof features, TableRow> => ({
				id: column.key,
				accessorFn: (row) =>
					column.sortValue
						? column.sortValue(row)
						: (row as Record<string, unknown>)[column.key],
				enableHiding: column.toggleable !== false,
				sortFn: (left, right, id) =>
					compareSortValues(left.getValue(id), right.getValue(id)),
			}),
		),
	)

	const table = createTable<typeof features, TableRow>({
		features,
		get data() {
			return rows() as TableRow[]
		},
		get columns() {
			return columnDefs()
		},
		getRowId: (row) => String(props.getRowId(row)),
		manualSorting: sortControlled,
		enableMultiSort: false,
		sortDescFirst: false,
		defaultColumn: { minSize: MIN_COLUMN_WIDTH },
		state: {
			get sorting() {
				return sorting()
			},
			get columnVisibility() {
				return columnVisibility()
			},
			get columnOrder() {
				return columnOrder()
			},
		},
		onSortingChange: changeSort,
		onColumnVisibilityChange: changeVisibility,
		onColumnOrderChange: (updater) => setColumnOrder(functionalUpdate(updater, columnOrder())),
	})

	/** The consumer's columns for table columns; rendering stays keyed on them. */
	const columnsByKey = createMemo(
		() => new Map(props.columns.map((column) => [column.key, column] as const)),
	)
	const toDataColumns = (columns: { id: string }[]) =>
		columns.flatMap((column) => columnsByKey().get(column.id) ?? [])
	const orderedColumns = createMemo(() => toDataColumns(table.getAllLeafColumns()))
	const visibleColumns = createMemo(() => toDataColumns(table.getVisibleLeafColumns()))
	// Rows are keyed by the consumer's objects so their DOM survives new `rows` arrays.
	const sortedRows = createMemo(() => table.getRowModel().rows.map((row) => row.original))
	const toggleableColumns = createMemo(() =>
		props.columns.filter((column) => column.toggleable !== false),
	)
	const allToggleableKeys = createMemo(() => toggleableColumns().map((column) => column.key))

	function changeSort(updater: Updater<SortingState>): void {
		const [entry] = functionalUpdate(updater, sorting())
		const next: DataTableSort | undefined = entry && {
			key: entry.id,
			direction: entry.desc ? 'desc' : 'asc',
		}
		// Only the sorted column can cycle to unsorted.
		const key = next?.key ?? sortKey()
		if (!sortControlled) setInternalSort(next)
		if (key !== undefined) props.onSort?.(key)
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

	function changeVisibility(updater: Updater<ColumnVisibilityState>): void {
		const next = functionalUpdate(updater, columnVisibility())
		// Keep keys for unknown/removed columns out of the state; non-toggleable
		// columns stay visible implicitly and are not tracked here.
		setVisibleKeys(allToggleableKeys().filter((key) => next[key]))
	}

	function setColumnOrder(next: string[]): void {
		if (props.columnOrder === undefined) setUncontrolledOrder(next)
		props.onColumnOrderChange?.(next)
	}

	/** Moves the column with `key` to `index` within the current order. */
	function moveColumn(key: string, index: number): void {
		const keys = table.getAllLeafColumns().map((column) => column.id)
		const from = keys.indexOf(key)
		if (from === -1 || index < 0 || index >= keys.length || index === from) return
		keys.splice(from, 1)
		keys.splice(index, 0, key)
		table.setColumnOrder(keys)
	}

	function resetColumns(): void {
		setVisibleKeys(defaultVisibleKeys())
		const keys = props.columns.map((column) => column.key)
		const known = (props.defaultColumnOrder ?? []).filter((key) => keys.includes(key))
		setColumnOrder([...new Set([...known, ...keys])])
	}

	// Pixel widths once resized; until then the browser lays out the columns.
	const widths = () => table.atoms.columnSizing.get()
	/** Width of what isn't a data column (actions); set once the table is resized. */
	const [extraWidth, setExtraWidth] = createSignal<number | undefined>()
	const tableWidth = () => {
		const extra = extraWidth()
		return extra === undefined ? undefined : table.getTotalSize() + extra
	}
	let tableRef: HTMLTableElement | undefined

	createEffect(() => {
		const keys = visibleColumns().map((column) => column.key)
		if (!tableRef || untrack(extraWidth) === undefined) return
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
		table.setColumnSizing(next)
	})

	/** Current rendered widths, which resizing pins so other columns don't shift. */
	function measureWidths(el: HTMLTableElement): { sizing: ColumnSizingState; extra: number } {
		const sizing: ColumnSizingState = {}
		for (const th of el.querySelectorAll<HTMLElement>('th[data-column-key]')) {
			sizing[th.dataset.columnKey as string] = th.getBoundingClientRect().width
		}
		const total = Object.values(sizing).reduce((sum, width) => sum + width, 0)
		return { sizing, extra: el.getBoundingClientRect().width - total }
	}

	function applyWidths(sizing: ColumnSizingState, extra: number): void {
		table.setColumnSizing(sizing)
		setExtraWidth(extra)
	}

	function startResize(event: PointerEvent, key: string): void {
		if (!tableRef) return
		event.preventDefault()
		event.stopPropagation()
		const handle = event.currentTarget as HTMLElement
		handle.setPointerCapture(event.pointerId)
		const startX = event.clientX
		const { sizing, extra } = measureWidths(tableRef)
		const startWidth = sizing[key] ?? MIN_COLUMN_WIDTH
		let moved = false

		function onMove(e: PointerEvent): void {
			if (!moved && Math.abs(e.clientX - startX) < 2) return
			moved = true
			const next = Math.max(MIN_COLUMN_WIDTH, startWidth + e.clientX - startX)
			applyWidths({ ...sizing, [key]: next }, extra)
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
		const { sizing, extra } = measureWidths(tableRef)
		const current = sizing[key] ?? MIN_COLUMN_WIDTH
		applyWidths({ ...sizing, [key]: Math.max(MIN_COLUMN_WIDTH, current + step) }, extra)
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

	function cell(row: TRow, column: DataTableColumn<TRow>): JSX.Element {
		return props.getCell?.(row, column) ?? column.getValue?.(row) ?? null
	}

	function ariaSort(column: DataTableColumn<TRow>): JSX.AriaAttributes['aria-sort'] {
		if (!column.sortable) return undefined
		if (sortKey() !== column.key) return 'none'
		return sortDirection() === 'asc' ? 'ascending' : 'descending'
	}

	function sortIndicator(column: DataTableColumn<TRow>): string {
		if (sortKey() !== column.key) return ''
		return sortDirection() === 'asc' ? '▲' : '▼'
	}

	const isSortable = (column: DataTableColumn<TRow>): boolean =>
		Boolean(column.sortable) && (!sortControlled || Boolean(props.onSort || props.onSortChange))

	function onDragStart(e: DragEvent, column: DataTableColumn<TRow>): void {
		setDraggedKey(column.key)
		e.dataTransfer?.setData('text/plain', column.key)
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
	}

	function onDragOver(e: DragEvent, index: number): void {
		const key = draggedKey()
		if (key === undefined) return
		e.preventDefault()
		moveColumn(key, index)
	}

	function customizerItem(column: DataTableColumn<TRow>, index: () => number): JSX.Element {
		return (
			<li
				class="data-table-customizer-item"
				classList={{ 'data-table-customizer-item-dragging': draggedKey() === column.key }}
				draggable="true"
				onDragStart={(e) => onDragStart(e, column)}
				onDragOver={(e) => onDragOver(e, index())}
				onDrop={(e) => e.preventDefault()}
				onDragEnd={() => setDraggedKey(undefined)}
			>
				<IconMenu class="data-table-customizer-grip" size={14} aria-hidden="true" />
				<label class="data-table-customizer-option">
					<input
						type="checkbox"
						checked={columnVisibility()[column.key]}
						disabled={column.toggleable === false}
						onChange={(e) =>
							table.getColumn(column.key)?.toggleVisibility(e.currentTarget.checked)
						}
					/>
					{column.ariaLabel ?? column.label}
				</label>
			</li>
		)
	}

	function customizerPanel(): JSX.Element {
		return (
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
						{(column, index) => customizerItem(column, index)}
					</For>
				</ul>
				<div class="data-table-customizer-actions">
					<button type="button" onClick={() => table.toggleAllColumnsVisible(true)}>
						{props.columnCustomizerShowAllLabel ?? 'Show all'}
					</button>
					<button type="button" onClick={resetColumns}>
						{props.columnCustomizerResetLabel ?? 'Reset'}
					</button>
				</div>
			</div>
		)
	}

	function customizer(): JSX.Element {
		return (
			<div ref={customizerRoot} class="data-table-customizer">
				<button
					type="button"
					class="data-table-customizer-button"
					aria-haspopup="dialog"
					aria-expanded={customizerOpen()}
					aria-controls={panelId}
					onClick={() => setCustomizerOpen((open) => !open)}
				>
					<span aria-hidden="true">⚙</span> {props.columnCustomizerLabel ?? 'Columns'}
				</button>
				<Show when={customizerOpen()}>{customizerPanel()}</Show>
			</div>
		)
	}

	function headerCell(column: DataTableColumn<TRow>): JSX.Element {
		return (
			<th
				class={column.class}
				data-column-key={column.key}
				style={columnStyle(column, widths()[column.key])}
				aria-sort={ariaSort(column)}
			>
				<Show when={isSortable(column)} fallback={column.label}>
					<button
						type="button"
						class="data-table-sort"
						onClick={() => table.getColumn(column.key)?.toggleSorting()}
					>
						{column.label}
						<span class="data-table-sort-indicator" aria-hidden="true">
							{sortIndicator(column)}
						</span>
					</button>
				</Show>
				<Show when={props.resizableColumns}>
					{/* biome-ignore lint/a11y/useSemanticElements: a focusable separator is the ARIA window-splitter pattern; <hr> can't take focus or key handlers */}
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
		)
	}

	function bodyRow(row: TRow): JSX.Element {
		return (
			<tr>
				<For each={visibleColumns()}>
					{(column) => (
						<td class={column.class} style={columnStyle(column, widths()[column.key])}>
							{cell(row, column)}
						</td>
					)}
				</For>
				<Show when={props.rowActions}>
					<td>{props.rowActions?.(row)}</td>
				</Show>
			</tr>
		)
	}

	const showEmpty = (): boolean =>
		!loading() && (props.empty === undefined ? rows().length === 0 : read(props.empty))

	return (
		<div class={`data-table-wrap${props.class ? ` ${props.class}` : ''}`}>
			<Show when={showCustomizer() || toolbar.toArray().length > 0}>
				<div class="data-table-toolbar">
					<Show when={toolbar.toArray().length > 0}>
						<div class="data-table-toolbar-start">{toolbar()}</div>
					</Show>
					<Show when={showCustomizer()}>{customizer()}</Show>
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
							<For each={visibleColumns()}>{headerCell}</For>
							<Show when={props.rowActions}>
								<th>Actions</th>
							</Show>
						</tr>
					</thead>
					<tbody>
						<For each={sortedRows()}>{bodyRow}</For>
					</tbody>
				</table>
			</div>
			<Show when={loading()}>
				{props.loadingContent ?? <p class="data-table-status">Loading…</p>}
			</Show>
			<Show when={showEmpty()}>
				{props.emptyContent ?? <p class="data-table-status">No results.</p>}
			</Show>
		</div>
	)
}
