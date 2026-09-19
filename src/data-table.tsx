import type { Accessor, JSX } from 'solid-js'
import { createEffect, createMemo, For, Show } from 'solid-js'

export type DataTableSortDirection = 'asc' | 'desc'

export interface DataTableColumn<TRow> {
	key: string
	label: string
	sortable?: boolean
	class?: string
	ariaLabel?: string
	getValue?: (row: TRow) => JSX.Element
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
	onSort?: (key: string) => void
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
	const sortKey = () => read(props.sortKey ?? undefined)
	const sortDirection = () => read(props.sortDirection ?? 'asc')
	const hasSelection = () => props.selected !== undefined && props.onSelectionChange !== undefined
	const allSelected = () => {
		const ids = selected()
		return (
			rows().length > 0 && rows().every((row) => ids.includes(props.getRowId(row) as never))
		)
	}

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

	function cell(row: TRow, column: DataTableColumn<TRow>): JSX.Element {
		return props.getCell?.(row, column) ?? column.getValue?.(row) ?? null
	}

	return (
		<div class={`data-table-wrap${props.class ? ` ${props.class}` : ''}`}>
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
						<For each={props.columns}>
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
										when={column.sortable && props.onSort}
										fallback={column.label}
									>
										<button
											type="button"
											class="data-table-sort"
											onClick={() => props.onSort?.(column.key)}
										>
											{column.label}
											{sortKey() === column.key
												? sortDirection() === 'asc'
													? ' ▲'
													: ' ▼'
												: ''}
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
					<For each={rows()}>
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
								<For each={props.columns}>
									{(column) => <td class={column.class}>{cell(row, column)}</td>}
								</For>
								<Show when={props.rowActions}>
									<td>{props.rowActions?.(row)}</td>
								</Show>
							</tr>
						)}
					</For>
				</tbody>
			</table>
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
