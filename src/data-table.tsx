import {
	IconCheck,
	IconChevronDown,
	IconChevronLeft,
	IconChevronRight,
	IconDeviceFloppy,
	IconMenu,
} from '@tabler/icons-solidjs'
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

/** The column setup a saved layout restores. */
export interface DataTableLayout {
	/** Visible toggleable columns; `toggleable: false` columns are always shown. */
	visibleColumns: string[]
	/** Every column in display order; missing columns are appended. */
	columnOrder: string[]
	/** Pixel widths by column key; empty or omitted for automatic layout. */
	columnWidths?: Record<string, number>
}

/** A named column layout the user saved for reuse. */
export interface DataTableSavedLayout {
	name: string
	layout: DataTableLayout
}

export interface DataTablePagination {
	/** Current page, starting at 1. */
	page: number
	pageSize: number
	/** Total rows across all pages. */
	rowCount: number
	/** Choices of the rows-per-page select; hidden when omitted. */
	pageSizeOptions?: number[]
}

export interface DataTablePaginationLabels {
	/** Accessible name of the pagination landmark. Defaults to `Pagination`. */
	navigation?: string
	/** Defaults to `Previous page`. */
	previous?: string
	/** Defaults to `Next page`. */
	next?: string
	/** Defaults to `Rows per page`. */
	pageSize?: string
	/** Defaults to `1–25 of 120`. */
	range?: (first: number, last: number, rowCount: number) => string
}

export interface DataTableProps<TRow> {
	rows: TRow[] | Accessor<TRow[]>
	columns: DataTableColumn<TRow>[]
	getRowId: (row: TRow) => string | number
	getCell?: (row: TRow, column: DataTableColumn<TRow>) => JSX.Element
	rowActions?: (row: TRow) => JSX.Element
	/** Header of the `rowActions` column. Defaults to `Actions`. */
	actionsLabel?: string
	sortKey?: string | Accessor<string | undefined>
	sortDirection?: DataTableSortDirection | Accessor<DataTableSortDirection>
	defaultSort?: DataTableSort
	onSort?: (key: string) => void
	onSortClear?: () => void
	onSortChange?: (sort: DataTableSort | undefined) => void
	visibleColumns?: string[] | Accessor<string[]>
	defaultVisibleColumns?: string[]
	onVisibleColumnsChange?: (visibleKeys: string[]) => void
	/**
	 * Persists the visible columns in `localStorage` under this exact key, e.g.
	 * `'myapp:columns:customers'`. Ignored while `visibleColumns` is controlled.
	 */
	storageKey?: string
	/** Controlled column order as column keys; pair with `onColumnOrderChange`. */
	columnOrder?: string[] | Accessor<string[]>
	defaultColumnOrder?: string[]
	onColumnOrderChange?: (orderedKeys: string[]) => void
	/** Shows a drag handle between column headers to resize columns. */
	resizableColumns?: boolean
	/** Restores pixel widths (by column key); a new value replaces the current widths, `{}` clears them. */
	columnWidths?: Record<string, number> | Accessor<Record<string, number>>
	/** Called with all current pixel widths (by column key) after a resize, and with `{}` on reset. */
	onColumnWidthsChange?: (widths: Record<string, number>) => void
	showColumnCustomizer?: boolean | Accessor<boolean>
	columnCustomizerLabel?: string
	columnCustomizerTitle?: string
	columnCustomizerShowAllLabel?: string
	columnCustomizerResetLabel?: string
	/**
	 * Saved column layouts (visibility, order, widths), listed in a menu opened by
	 * an arrow beside the column customizer button. Passing this (even `[]`)
	 * enables saving: "Save layout" names the current layout and emits the new
	 * list through `onSavedLayoutsChange`; persisting it is up to you.
	 */
	savedLayouts?: DataTableSavedLayout[] | Accessor<DataTableSavedLayout[]>
	onSavedLayoutsChange?: (savedLayouts: DataTableSavedLayout[]) => void
	/** Names the layout menu and its trigger. Defaults to `Saved layouts`. */
	savedLayoutsLabel?: string
	/** Defaults to `Save layout`. */
	saveLayoutLabel?: string
	/** Defaults to `Layout name`. */
	layoutNameLabel?: string
	/** Defaults to `Cancel`. */
	cancelLabel?: string
	/** Content rendered at the start of the toolbar, before the column customizer. */
	toolbar?: JSX.Element
	/** Keeps the header visible while the rows scroll, inside a viewport capped by `--data-table-max-height`. */
	stickyHeader?: boolean
	/** Keeps the `rowActions` column visible while the columns scroll horizontally. */
	stickyActions?: boolean
	/** Draws a vertical line between columns. */
	columnLines?: boolean
	/** Renders a pager for server-side pagination; `rows` must hold only the current page. */
	pagination?: DataTablePagination | Accessor<DataTablePagination>
	onPaginationChange?: (pagination: { page: number; pageSize: number }) => void
	paginationLabels?: DataTablePaginationLabels
	loading?: boolean | Accessor<boolean>
	empty?: boolean | Accessor<boolean>
	/** Replaces the skeleton rows and the loading text. */
	loadingContent?: JSX.Element
	/** Skeleton rows shown while loading without rows. Defaults to 5. */
	skeletonRows?: number
	emptyContent?: JSX.Element
	/**
	 * Splits the rows into collapsible groups by key, each its own `<tbody>`
	 * under a heading row; rows keep the table's sort within their group.
	 */
	groupBy?: (row: TRow) => string
	/** Heading content of a group, after its toggle. Defaults to the key. */
	groupLabel?: (key: string, rows: TRow[]) => JSX.Element
	/** Group keys in display order; unlisted groups follow in row order. */
	groupOrder?: string[] | Accessor<string[]>
	/** Whether a group starts expanded. Defaults to expanded. */
	defaultGroupOpen?: (key: string, rows: TRow[]) => boolean
	class?: string
}

const MIN_COLUMN_WIDTH = 40
const DEFAULT_SKELETON_ROWS = 5

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

/** Visible column keys saved under `key`, or undefined when unset, corrupt, or unavailable. */
function loadVisibleKeys(key: string | undefined): string[] | undefined {
	if (key === undefined) return undefined
	try {
		const raw = globalThis.localStorage?.getItem(key)
		if (!raw) return undefined
		const parsed: unknown = JSON.parse(raw)
		return Array.isArray(parsed) && parsed.every((value) => typeof value === 'string')
			? parsed
			: undefined
	} catch {
		return undefined
	}
}

/** Saves visible column keys under `key`; undefined removes the entry. */
function saveVisibleKeys(key: string | undefined, keys: string[] | undefined): void {
	if (key === undefined) return
	try {
		if (keys === undefined) globalThis.localStorage?.removeItem(key)
		else globalThis.localStorage?.setItem(key, JSON.stringify(keys))
	} catch {
		// Storage full or unavailable (private mode): the choice lasts for the session.
	}
}

function sameKeys(a: string[], b: string[]): boolean {
	return a.length === b.length && a.every((key, index) => key === b[index])
}

function sameLayout(a: Required<DataTableLayout>, b: Required<DataTableLayout>): boolean {
	const widths = Object.keys(a.columnWidths)
	return (
		sameKeys(a.visibleColumns, b.visibleColumns) &&
		sameKeys(a.columnOrder, b.columnOrder) &&
		widths.length === Object.keys(b.columnWidths).length &&
		widths.every((key) => a.columnWidths[key] === b.columnWidths[key])
	)
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
	// Read once: the key names a table, it is not expected to change.
	const storageKey = untrack(() => props.storageKey)
	const [uncontrolledVisible, setUncontrolledVisible] = createSignal<string[] | undefined>(
		untrack(() =>
			props.visibleColumns === undefined ? loadVisibleKeys(storageKey) : undefined,
		),
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
	/** Sorted rows per group key, in `groupOrder` and then first-row order. */
	const groupedRows = createMemo(() => {
		const groupBy = props.groupBy
		const groups = new Map<string, TRow[]>()
		if (!groupBy) return groups
		for (const key of read(props.groupOrder ?? [])) groups.set(key, [])
		for (const row of sortedRows()) {
			const key = groupBy(row)
			const members = groups.get(key)
			if (members) members.push(row)
			else groups.set(key, [row])
		}
		for (const [key, members] of groups) {
			if (members.length === 0) groups.delete(key)
		}
		return groups
	})
	// Keyed by string so a group's DOM survives new rows.
	const groupKeys = createMemo(() => [...groupedRows().keys()])
	const groupRows = (key: string): TRow[] => groupedRows().get(key) ?? []
	/** Explicit expand/collapse choices; other groups follow `defaultGroupOpen`. */
	const [groupToggles, setGroupToggles] = createSignal<Record<string, boolean>>({})
	const isGroupOpen = (key: string): boolean =>
		groupToggles()[key] ?? props.defaultGroupOpen?.(key, groupRows(key)) ?? true
	function toggleGroup(key: string): void {
		const open = isGroupOpen(key)
		setGroupToggles((toggles) => ({ ...toggles, [key]: !open }))
	}
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
			saveVisibleKeys(storageKey, ordered)
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

	/** `order` limited to known columns, with missing ones appended. */
	function completeOrder(order: string[]): string[] {
		const keys = props.columns.map((column) => column.key)
		const known = order.filter((key) => keys.includes(key))
		return [...new Set([...known, ...keys])]
	}

	function resetColumns(): void {
		setVisibleKeys(defaultVisibleKeys())
		// Forget the saved choice so later changes to the defaults apply.
		if (props.visibleColumns === undefined) saveVisibleKeys(storageKey, undefined)
		setColumnOrder(completeOrder(props.defaultColumnOrder ?? []))
		clearWidths()
		props.onColumnWidthsChange?.({})
	}

	// Pixel widths once resized; until then the browser lays out the columns.
	// The table then fills its container at least (`min-width: 100%`), and a
	// filler cell at the end of each row takes what the columns leave.
	const widths = () => table.atoms.columnSizing.get()
	/** Content width of the actions column, if any; set once the table is resized. */
	const [extraWidth, setExtraWidth] = createSignal<number | undefined>()
	const tableWidth = () => {
		const extra = extraWidth()
		return extra === undefined ? undefined : table.getTotalSize() + extra
	}
	let tableRef: HTMLTableElement | undefined

	function clearWidths(): void {
		// In this order: without an extra width, nothing refits the emptied columns.
		setExtraWidth(undefined)
		table.setColumnSizing({})
	}

	/**
	 * Content width of the column at `index`. Cells can't report it in place: they
	 * fill their column, so it is measured on copies in an unconstrained table that
	 * sits beside the real one and picks up the same CSS.
	 */
	function fitColumn(index: number): number {
		if (!tableRef) return 0
		const probe = tableRef.cloneNode(false) as HTMLTableElement
		probe.classList.remove('data-table-resized')
		probe.style.cssText = 'position:absolute;visibility:hidden;width:max-content;max-width:none'
		for (const row of tableRef.rows) {
			if (row.classList.contains('data-table-group-row')) continue
			const cell = row.cells[index]?.cloneNode(true) as HTMLTableCellElement | undefined
			if (!cell) continue
			cell.removeAttribute('style')
			probe.insertRow().append(cell)
		}
		tableRef.after(probe)
		const width = probe.getBoundingClientRect().width
		probe.remove()
		return Math.ceil(width)
	}

	const actionsIndex = () => visibleColumns().length

	createEffect(() => {
		if (props.columnWidths === undefined) return
		const restored = read(props.columnWidths)
		if (Object.keys(restored).length === 0) {
			clearWidths()
			return
		}
		table.setColumnSizing(restored)
		setExtraWidth((extra) => extra ?? (props.rowActions ? fitColumn(untrack(actionsIndex)) : 0))
	})

	// Columns without a width, e.g. one that was re-shown or added since the widths were saved.
	createEffect(() => {
		const keys = visibleColumns().map((column) => column.key)
		const current = widths()
		if (extraWidth() === undefined || keys.every((key) => current[key] !== undefined)) return
		const next = { ...current }
		for (const [index, key] of keys.entries()) {
			next[key] ??= Math.max(MIN_COLUMN_WIDTH, fitColumn(index))
		}
		table.setColumnSizing(next)
	})

	// Pinned widths hold the actions column to its size when they were set, which
	// can predate the rows.
	createEffect(() => {
		sortedRows()
		const extra = untrack(extraWidth)
		if (!props.rowActions || extra === undefined) return
		setExtraWidth(Math.max(extra, fitColumn(untrack(actionsIndex))))
	})

	/**
	 * Current rendered widths, which resizing pins so other columns don't shift.
	 * The actions column is pinned to its content; the space it may fill until
	 * then goes to the filler.
	 */
	function measureWidths(el: HTMLTableElement): { sizing: ColumnSizingState; extra: number } {
		const sizing: ColumnSizingState = {}
		for (const th of el.querySelectorAll<HTMLElement>('th[data-column-key]')) {
			sizing[th.dataset.columnKey as string] = th.getBoundingClientRect().width
		}
		return { sizing, extra: props.rowActions ? fitColumn(actionsIndex()) : 0 }
	}

	const resized = () => tableWidth() !== undefined
	const actionsStyle = (): JSX.CSSProperties | undefined =>
		resized() ? { width: `${extraWidth()}px` } : undefined

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

	function autofit(key: string): void {
		if (!tableRef) return
		const index = visibleColumns().findIndex((column) => column.key === key)
		const { sizing, extra } = measureWidths(tableRef)
		applyWidths({ ...sizing, [key]: Math.max(MIN_COLUMN_WIDTH, fitColumn(index)) }, extra)
		props.onColumnWidthsChange?.(widths())
	}

	function resizeByKey(event: KeyboardEvent, key: string): void {
		if (event.key === 'Enter') {
			event.preventDefault()
			autofit(key)
			return
		}
		const step = event.key === 'ArrowLeft' ? -10 : event.key === 'ArrowRight' ? 10 : 0
		if (!step || !tableRef) return
		event.preventDefault()
		const { sizing, extra } = measureWidths(tableRef)
		const current = sizing[key] ?? MIN_COLUMN_WIDTH
		applyWidths({ ...sizing, [key]: Math.max(MIN_COLUMN_WIDTH, current + step) }, extra)
		props.onColumnWidthsChange?.(widths())
	}

	/**
	 * `layout` against the current columns: unknown keys dropped, the order
	 * completed, and widths rounded and kept for visible columns only, so equal
	 * layouts compare equal.
	 */
	function normalizeLayout(layout: DataTableLayout): Required<DataTableLayout> {
		const visible = new Set(layout.visibleColumns)
		const visibleColumns = allToggleableKeys().filter((key) => visible.has(key))
		const shown = (key: string) =>
			visible.has(key) || columnsByKey().get(key)?.toggleable === false
		const columnWidths: Record<string, number> = {}
		for (const [key, width] of Object.entries(layout.columnWidths ?? {})) {
			if (columnsByKey().has(key) && shown(key) && Number.isFinite(width) && width > 0) {
				columnWidths[key] = Math.round(width)
			}
		}
		return { visibleColumns, columnOrder: completeOrder(layout.columnOrder), columnWidths }
	}

	/** The layout on screen; widths only once the columns are resized. */
	const currentLayout = createMemo(() =>
		normalizeLayout({
			visibleColumns: visibleKeys(),
			columnOrder: orderedColumns().map((column) => column.key),
			columnWidths: resized() ? widths() : {},
		}),
	)

	const savedLayouts = createMemo(() =>
		props.savedLayouts !== undefined ? read(props.savedLayouts) : undefined,
	)
	/** The saved layout equal to the current one, checked in the menu. */
	const currentSavedLayout = createMemo(() => {
		const current = currentLayout()
		return savedLayouts()?.find((saved) => sameLayout(normalizeLayout(saved.layout), current))
	})
	const [namingLayout, setNamingLayout] = createSignal(false)
	const [layoutName, setLayoutName] = createSignal('')

	function applyLayout(name: string): void {
		const saved = savedLayouts()?.find((s) => s.name === name)
		if (!saved) return
		const layout = normalizeLayout(saved.layout)
		setVisibleKeys(layout.visibleColumns)
		setColumnOrder(layout.columnOrder)
		if (Object.keys(layout.columnWidths).length === 0) {
			clearWidths()
			props.onColumnWidthsChange?.({})
			return
		}
		table.setColumnSizing(layout.columnWidths)
		// Fits the actions column, then the fit effect fills visible columns without a width.
		setExtraWidth((extra) => extra ?? (props.rowActions ? fitColumn(actionsIndex()) : 0))
		props.onColumnWidthsChange?.(widths())
	}

	/** Saves the current layout, replacing a saved layout of the same name. */
	function saveLayout(event: SubmitEvent): void {
		event.preventDefault()
		const name = layoutName().trim()
		if (name === '') return
		const others = (savedLayouts() ?? []).filter((s) => s.name !== name)
		props.onSavedLayoutsChange?.([...others, { name, layout: currentLayout() }])
		closeLayoutMenu()
	}

	const [draggedKey, setDraggedKey] = createSignal<string | undefined>()

	const customizerId = createUniqueId()
	const panelId = `${customizerId}-panel`
	const layoutMenuId = `${customizerId}-layouts`
	/** At most one popup is open: the column panel or the layout menu. */
	const [popup, setPopup] = createSignal<'columns' | 'layouts' | undefined>()
	const customizerOpen = () => popup() === 'columns'
	const layoutMenuOpen = () => popup() === 'layouts'
	let customizerRoot: HTMLDivElement | undefined
	let layoutTrigger: HTMLButtonElement | undefined
	let layoutMenu: HTMLDivElement | undefined

	function layoutItems(): HTMLElement[] {
		return [...(layoutMenu?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])]
	}

	/** Opens the layout menu and focuses the checked item, else the first or last one. */
	function openLayoutMenu(edge: 'first' | 'last'): void {
		setNamingLayout(false)
		setPopup('layouts')
		const items = layoutItems()
		const checked = items.find((item) => item.getAttribute('aria-checked') === 'true')
		;(checked ?? (edge === 'first' ? items[0] : items.at(-1)))?.focus()
	}

	function closeLayoutMenu(): void {
		setPopup(undefined)
		layoutTrigger?.focus()
	}

	function onLayoutTriggerKeyDown(event: KeyboardEvent): void {
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
		event.preventDefault()
		openLayoutMenu(event.key === 'ArrowDown' ? 'first' : 'last')
	}

	/** Menu keyboard pattern: arrows and Home/End move, Escape returns to the trigger. */
	function onLayoutMenuKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault()
			closeLayoutMenu()
			return
		}
		if (event.key === 'Tab') {
			setPopup(undefined)
			return
		}
		const items = layoutItems()
		const index = items.indexOf(document.activeElement as HTMLElement)
		const next =
			event.key === 'ArrowDown'
				? (index + 1) % items.length
				: event.key === 'ArrowUp'
					? (index - 1 + items.length) % items.length
					: event.key === 'Home'
						? 0
						: event.key === 'End'
							? items.length - 1
							: -1
		if (next === -1) return
		event.preventDefault()
		items[next]?.focus()
	}

	function pickLayout(name: string): void {
		applyLayout(name)
		closeLayoutMenu()
	}

	function startSavingLayout(): void {
		setLayoutName(currentSavedLayout()?.name ?? '')
		setNamingLayout(true)
	}

	createEffect(() => {
		if (popup() === undefined || !showCustomizer()) {
			setNamingLayout(false)
			return
		}
		function onPointerDown(event: PointerEvent): void {
			if (customizerRoot && !customizerRoot.contains(event.target as Node)) {
				setPopup(undefined)
			}
		}
		// Escape handled inside a popup (the layout menu, its name form) is prevented.
		function onKeyDown(event: KeyboardEvent): void {
			if (event.key === 'Escape' && !event.defaultPrevented) setPopup(undefined)
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

	function moveByKey(e: KeyboardEvent, column: DataTableColumn<TRow>, index: number): void {
		const step = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
		if (!e.altKey || !step) return
		e.preventDefault()
		const focused = document.activeElement as HTMLElement | null
		moveColumn(column.key, index + step)
		// Reordering may detach the focused element.
		focused?.focus()
	}

	/** Native drag and drop doesn't reach touch input, so the grip tracks the pointer itself. */
	function startPointerDrag(e: PointerEvent, column: DataTableColumn<TRow>): void {
		if (e.pointerType === 'mouse') return
		setDraggedKey(column.key)
		// On the document: reordering may detach the grip, which ends pointer capture.
		function onMove(event: PointerEvent): void {
			const item = document
				.elementFromPoint(event.clientX, event.clientY)
				?.closest('.data-table-customizer-item')
			if (!item?.parentElement) return
			moveColumn(column.key, Array.prototype.indexOf.call(item.parentElement.children, item))
		}
		function onUp(): void {
			document.removeEventListener('pointermove', onMove)
			document.removeEventListener('pointerup', onUp)
			document.removeEventListener('pointercancel', onUp)
			setDraggedKey(undefined)
		}
		document.addEventListener('pointermove', onMove)
		document.addEventListener('pointerup', onUp)
		document.addEventListener('pointercancel', onUp)
	}

	function customizerItem(column: DataTableColumn<TRow>, index: () => number): JSX.Element {
		const label = column.ariaLabel ?? column.label
		return (
			<li
				class="data-table-customizer-item"
				classList={{ 'data-table-customizer-item-dragging': draggedKey() === column.key }}
				draggable="true"
				onDragStart={(e) => onDragStart(e, column)}
				onDragOver={(e) => onDragOver(e, index())}
				onDrop={(e) => e.preventDefault()}
				onDragEnd={() => setDraggedKey(undefined)}
				onKeyDown={(e) => moveByKey(e, column, index())}
			>
				{/* Keyboard users reach an item through its checkbox; a disabled one can't take focus, so its grip does. */}
				{/* biome-ignore lint/a11y/useSemanticElements: the grip is where a native drag starts, which a <button> doesn't reliably do */}
				{/* biome-ignore lint/a11y/useFocusableInteractive: tabindex is set, just not literally */}
				<span
					class="data-table-customizer-grip"
					role="button"
					aria-label={`Reorder ${label}`}
					aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
					tabindex={column.toggleable === false ? 0 : -1}
					onPointerDown={(e) => startPointerDrag(e, column)}
				>
					<IconMenu size={14} aria-hidden="true" />
				</span>
				<label class="data-table-customizer-option">
					<input
						type="checkbox"
						checked={columnVisibility()[column.key]}
						disabled={column.toggleable === false}
						aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
						onChange={(e) =>
							table.getColumn(column.key)?.toggleVisibility(e.currentTarget.checked)
						}
					/>
					{label}
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

	function layoutMenuItem(saved: DataTableSavedLayout): JSX.Element {
		const checked = () => currentSavedLayout()?.name === saved.name
		return (
			<button
				type="button"
				role="menuitemradio"
				class="data-table-layout-item"
				aria-checked={checked()}
				tabindex="-1"
				onClick={() => pickLayout(saved.name)}
			>
				<span class="data-table-layout-check" aria-hidden="true">
					<Show when={checked()}>
						<IconCheck size={14} />
					</Show>
				</span>
				{saved.name}
			</button>
		)
	}

	function layoutMenuContent(): JSX.Element {
		return (
			<div
				ref={layoutMenu}
				id={layoutMenuId}
				role="menu"
				aria-label={props.savedLayoutsLabel ?? 'Saved layouts'}
				class="data-table-customizer-panel data-table-layout-menu"
				onKeyDown={onLayoutMenuKeyDown}
			>
				<For each={savedLayouts() ?? []}>{layoutMenuItem}</For>
				<Show when={(savedLayouts()?.length ?? 0) > 0}>
					<hr class="data-table-layout-separator" />
				</Show>
				<button
					type="button"
					role="menuitem"
					class="data-table-layout-item"
					tabindex="-1"
					onClick={startSavingLayout}
				>
					<span class="data-table-layout-check" aria-hidden="true">
						<IconDeviceFloppy size={14} />
					</span>
					{`${props.saveLayoutLabel ?? 'Save layout'}…`}
				</button>
			</div>
		)
	}

	function layoutSaveDialog(): JSX.Element {
		const saveLabel = () => props.saveLayoutLabel ?? 'Save layout'
		return (
			<div
				id={layoutMenuId}
				role="dialog"
				aria-label={saveLabel()}
				class="data-table-customizer-panel"
			>
				<form
					class="data-table-layout-save"
					onSubmit={saveLayout}
					onKeyDown={(e) => {
						if (e.key !== 'Escape') return
						e.preventDefault()
						closeLayoutMenu()
					}}
				>
					<input
						ref={(el) => queueMicrotask(() => el.focus())}
						type="text"
						aria-label={props.layoutNameLabel ?? 'Layout name'}
						placeholder={props.layoutNameLabel ?? 'Layout name'}
						value={layoutName()}
						onInput={(e) => setLayoutName(e.currentTarget.value)}
					/>
					<div class="data-table-customizer-actions">
						<button type="submit">
							<IconDeviceFloppy size={14} aria-hidden="true" />
							{saveLabel()}
						</button>
						<button type="button" onClick={closeLayoutMenu}>
							{props.cancelLabel ?? 'Cancel'}
						</button>
					</div>
				</form>
			</div>
		)
	}

	function layoutTriggerButton(): JSX.Element {
		return (
			<button
				ref={layoutTrigger}
				type="button"
				class="data-table-customizer-button data-table-layout-trigger"
				aria-label={props.savedLayoutsLabel ?? 'Saved layouts'}
				aria-haspopup="menu"
				aria-expanded={layoutMenuOpen()}
				aria-controls={layoutMenuId}
				onClick={() => (layoutMenuOpen() ? setPopup(undefined) : openLayoutMenu('first'))}
				onKeyDown={onLayoutTriggerKeyDown}
			>
				<IconChevronDown size={14} aria-hidden="true" />
			</button>
		)
	}

	function customizer(): JSX.Element {
		const hasLayouts = () => savedLayouts() !== undefined
		return (
			<div ref={customizerRoot} class="data-table-customizer">
				<button
					type="button"
					class="data-table-customizer-button"
					classList={{ 'data-table-customizer-button-split': hasLayouts() }}
					aria-haspopup="dialog"
					aria-expanded={customizerOpen()}
					aria-controls={panelId}
					onClick={() => setPopup(customizerOpen() ? undefined : 'columns')}
				>
					<span aria-hidden="true">⚙</span> {props.columnCustomizerLabel ?? 'Columns'}
				</button>
				<Show when={hasLayouts()}>{layoutTriggerButton()}</Show>
				<Show when={customizerOpen()}>{customizerPanel()}</Show>
				<Show when={layoutMenuOpen()}>
					<Show when={namingLayout()} fallback={layoutMenuContent()}>
						{layoutSaveDialog()}
					</Show>
				</Show>
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
						onDblClick={() => autofit(column.key)}
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
					<td class="data-table-actions" style={actionsStyle()}>
						{props.rowActions?.(row)}
					</td>
				</Show>
				<Show when={resized()}>
					<td class="data-table-filler" aria-hidden="true" />
				</Show>
			</tr>
		)
	}

	function groupBody(key: string): JSX.Element {
		return (
			<tbody class="data-table-group">
				<tr class="data-table-group-row">
					<th
						scope="rowgroup"
						colSpan={
							visibleColumns().length +
							(props.rowActions ? 1 : 0) +
							(resized() ? 1 : 0)
						}
					>
						<button
							type="button"
							class="data-table-group-toggle"
							aria-expanded={isGroupOpen(key)}
							onClick={() => toggleGroup(key)}
						>
							<IconChevronDown
								size={14}
								aria-hidden="true"
								class="data-table-group-chevron"
							/>
							{props.groupLabel ? props.groupLabel(key, groupRows(key)) : key}
						</button>
					</th>
				</tr>
				<Show when={isGroupOpen(key)}>
					<For each={groupRows(key)}>{bodyRow}</For>
				</Show>
			</tbody>
		)
	}

	function skeletonRow(): JSX.Element {
		return (
			// biome-ignore lint/a11y/noAriaHiddenOnFocusable: skeleton cells hold nothing focusable
			<tr aria-hidden="true">
				<For each={visibleColumns()}>
					{(column) => (
						<td class={column.class} style={columnStyle(column, widths()[column.key])}>
							<span class="data-table-skeleton" />
						</td>
					)}
				</For>
				<Show when={props.rowActions}>
					<td class="data-table-actions" style={actionsStyle()}>
						<span class="data-table-skeleton" />
					</td>
				</Show>
				<Show when={resized()}>
					<td class="data-table-filler" />
				</Show>
			</tr>
		)
	}

	const pagination = () => read(props.pagination)
	const pageCount = () => {
		const current = pagination()
		return current ? Math.max(1, Math.ceil(current.rowCount / current.pageSize)) : 1
	}

	function changePage(page: number): void {
		const current = pagination()
		if (current) props.onPaginationChange?.({ page, pageSize: current.pageSize })
	}

	function rangeLabel(current: DataTablePagination): string {
		const first = Math.min((current.page - 1) * current.pageSize + 1, current.rowCount)
		const last = Math.min(current.page * current.pageSize, current.rowCount)
		const format = props.paginationLabels?.range
		return format
			? format(first, last, current.rowCount)
			: `${first}–${last} of ${current.rowCount}`
	}

	function pager(current: () => DataTablePagination): JSX.Element {
		return (
			<nav
				class="data-table-pagination"
				aria-label={props.paginationLabels?.navigation ?? 'Pagination'}
			>
				<Show when={current().pageSizeOptions}>
					{(options) => (
						<label class="data-table-page-size">
							{props.paginationLabels?.pageSize ?? 'Rows per page'}
							<select
								value={current().pageSize}
								onChange={(e) =>
									props.onPaginationChange?.({
										page: 1,
										pageSize: Number(e.currentTarget.value),
									})
								}
							>
								<For each={options()}>
									{(size) => (
										<option value={size} selected={size === current().pageSize}>
											{size}
										</option>
									)}
								</For>
							</select>
						</label>
					)}
				</Show>
				<span aria-live="polite">{rangeLabel(current())}</span>
				<button
					type="button"
					aria-label={props.paginationLabels?.previous ?? 'Previous page'}
					disabled={current().page <= 1}
					onClick={() => changePage(current().page - 1)}
				>
					<IconChevronLeft size={16} aria-hidden="true" />
				</button>
				<button
					type="button"
					aria-label={props.paginationLabels?.next ?? 'Next page'}
					disabled={current().page >= pageCount()}
					onClick={() => changePage(current().page + 1)}
				>
					<IconChevronRight size={16} aria-hidden="true" />
				</button>
			</nav>
		)
	}

	const showEmpty = (): boolean =>
		!loading() && (props.empty === undefined ? rows().length === 0 : read(props.empty))

	const showSkeleton = (): boolean =>
		loading() && sortedRows().length === 0 && props.loadingContent === undefined

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
					classList={{
						'data-table-resized': tableWidth() !== undefined,
						'data-table-sticky-header': props.stickyHeader,
						'data-table-sticky-actions': props.stickyActions,
						'data-table-column-lines': props.columnLines,
					}}
					aria-busy={loading()}
					style={tableWidth() !== undefined ? { width: `${tableWidth()}px` } : undefined}
				>
					<thead>
						<tr>
							<For each={visibleColumns()}>{headerCell}</For>
							<Show when={props.rowActions}>
								<th class="data-table-actions" style={actionsStyle()}>
									{props.actionsLabel ?? 'Actions'}
								</th>
							</Show>
							<Show when={resized()}>
								{/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: an empty header cell, nothing focusable */}
								<th class="data-table-filler" aria-hidden="true" />
							</Show>
						</tr>
					</thead>
					<Show when={props.groupBy}>
						<For each={groupKeys()}>{groupBody}</For>
					</Show>
					<tbody>
						<Show when={!props.groupBy}>
							<For each={sortedRows()}>{bodyRow}</For>
						</Show>
						<Show when={showSkeleton()}>
							<For
								each={Array.from({
									length: props.skeletonRows ?? DEFAULT_SKELETON_ROWS,
								})}
							>
								{skeletonRow}
							</For>
						</Show>
					</tbody>
				</table>
			</div>
			<Show when={loading()}>
				{props.loadingContent ?? (
					<p
						class="data-table-status"
						classList={{ 'data-table-visually-hidden': showSkeleton() }}
						role="status"
					>
						Loading…
					</p>
				)}
			</Show>
			<Show when={showEmpty()}>
				{props.emptyContent ?? <p class="data-table-status">No results.</p>}
			</Show>
			<Show when={pagination()}>{pager}</Show>
		</div>
	)
}
