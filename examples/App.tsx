import { IconBulb, IconPlant, IconSpeakerphone } from '@tabler/icons-solidjs'
import { createEffect, createSignal, For, Match, onCleanup, Show, Switch } from 'solid-js'
import {
	ColorInput,
	Combobox,
	type ComboboxOption,
	DataTable,
	type DataTableColumn,
	type DataTablePagination,
	type DataTableSort,
	FilterTable,
	type FilterTableSavedFilter,
	type FilterTableValues,
	Modal,
	SearchBar,
} from '../src'
import { type Device, deviceColumns, deviceFilters, devices } from './devices'
import '../src/styles.css'
import './styles.css'
import './table-demo.css'

type Product = {
	id: number
	name: string
	category: string
	price: number
	stock: number
}

const products: Product[] = [
	{ id: 1, name: 'Aurora Lamp', category: 'Lighting', price: 129, stock: 42 },
	{ id: 2, name: 'Terra Planter', category: 'Decor', price: 64, stock: 8 },
	{ id: 3, name: 'Orbit Speaker', category: 'Audio', price: 199, stock: 0 },
]

const columns: DataTableColumn<Product>[] = [
	{
		key: 'name',
		label: 'Name',
		sortable: true,
		toggleable: false,
		getValue: (product) => product.name,
	},
	{ key: 'category', label: 'Category', sortable: true, getValue: (product) => product.category },
	{ key: 'price', label: 'Price', sortable: true, getValue: (product) => `$${product.price}` },
	{
		key: 'stock',
		label: 'Stock',
		sortable: true,
		defaultVisible: false,
		getValue: (product) => product.stock,
	},
]

const minimalColumns: DataTableColumn<Product>[] = [
	{ key: 'name', label: 'Name', getValue: (product) => product.name },
	{ key: 'category', label: 'Category', getValue: (product) => product.category },
	{ key: 'price', label: 'Price', getValue: (product) => `$${product.price}` },
	{ key: 'stock', label: 'Stock', getValue: (product) => product.stock },
]

const categoryIcons = { Lighting: IconBulb, Decor: IconPlant, Audio: IconSpeakerphone }

/** Line drawing of the Aurora Lamp, the example's graphical preview. */
function LampSketch() {
	return (
		<svg
			viewBox="0 0 48 48"
			width="64"
			height="64"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="M16 6 H32 L38 20 H10 Z" fill="currentColor" fill-opacity="0.15" />
			<path d="M24 20 V40 M15 42 H33" />
		</svg>
	)
}

const productOptions: ComboboxOption[] = products.map((product) => ({
	value: product.id,
	label: product.name,
	detail: product.category,
	icon: categoryIcons[product.category as keyof typeof categoryIcons],
	preview:
		product.id === 1
			? LampSketch
			: () => (
					<span>
						${product.price} · {product.stock} in stock
					</span>
				),
}))

function deviceCell(device: Device, column: DataTableColumn<Device>) {
	if (column.key === 'status') {
		return (
			<span class={`device-status device-status-${device.status.toLowerCase()}`}>
				{device.status}
			</span>
		)
	}
	return column.getValue?.(device) ?? String(device[column.key as keyof Device])
}

const pages = [
	{ id: 'data-table', label: 'DataTable' },
	{ id: 'filter-table', label: 'FilterTable' },
	{ id: 'combobox', label: 'Combobox' },
	{ id: 'modal', label: 'Modal' },
	{ id: 'search-bar', label: 'SearchBar' },
	{ id: 'color-input', label: 'ColorInput' },
] as const

type PageId = (typeof pages)[number]['id']

function readPage(): PageId {
	const id = location.hash.slice(1)
	return pages.find((page) => page.id === id)?.id ?? pages[0].id
}

const SAVED_FILTERS_KEY = 'solid-components-example-saved-filters'
const COLUMN_ORDER_KEY = 'solid-components-example-column-order'
const COLUMN_WIDTHS_KEY = 'solid-components-example-column-widths'

/** Stands in for a backend: `rows` is only ever the requested page. */
function fetchDevices(sort: DataTableSort | undefined, page: number, pageSize: number) {
	const direction = sort?.direction === 'desc' ? -1 : 1
	const value = (device: Device) => String(device[sort?.key as keyof Device] ?? '')
	const sorted = sort
		? [...devices].sort((a, b) => direction * value(a).localeCompare(value(b)))
		: devices
	const start = (page - 1) * pageSize
	return new Promise<Device[]>((resolve) => {
		setTimeout(() => resolve(sorted.slice(start, start + pageSize)), 400)
	})
}

function ServerSideTable() {
	const [sort, setSort] = createSignal<DataTableSort>()
	const [paging, setPaging] = createSignal({ page: 1, pageSize: 5 })
	const [rows, setRows] = createSignal<Device[]>([])
	const [loading, setLoading] = createSignal(true)
	let latest = 0

	createEffect(() => {
		const request = ++latest
		const { page, pageSize } = paging()
		setLoading(true)
		fetchDevices(sort(), page, pageSize).then((next) => {
			if (request !== latest) return
			setRows(next)
			setLoading(false)
		})
	})

	const pagination = (): DataTablePagination => ({
		...paging(),
		rowCount: devices.length,
		pageSizeOptions: [5, 10, 25],
	})

	return (
		<DataTable
			rows={rows}
			columns={deviceColumns}
			getRowId={(device) => device.id}
			getCell={deviceCell}
			sortKey={() => sort()?.key}
			sortDirection={() => sort()?.direction ?? 'asc'}
			onSortChange={(next) => {
				setSort(next)
				setPaging((current) => ({ ...current, page: 1 }))
			}}
			pagination={pagination}
			onPaginationChange={setPaging}
			loading={loading}
			stickyHeader
			stickyActions
			rowActions={(device) => (
				<button type="button" aria-label={`Open ${device.name}`}>
					Open
				</button>
			)}
		/>
	)
}

export default function App() {
	const [page, setPage] = createSignal(readPage())
	const [loading, setLoading] = createSignal(false)
	const [empty, setEmpty] = createSignal(false)
	const [product, setProduct] = createSignal('')
	const [added, setAdded] = createSignal<string>()
	const [search, setSearch] = createSignal('')
	const [color, setColor] = createSignal('#3b82f6')
	const [modalOpen, setModalOpen] = createSignal(false)
	const [modalName, setModalName] = createSignal('Aurora Lamp')
	const [modalDirty, setModalDirty] = createSignal(false)
	const [discardOpen, setDiscardOpen] = createSignal(false)
	const [filterValues, setFilterValues] = createSignal<FilterTableValues>({})
	const [savedFilters, setSavedFilters] = createSignal<FilterTableSavedFilter[]>(
		JSON.parse(localStorage.getItem(SAVED_FILTERS_KEY) ?? '[]'),
	)

	let answerDiscard: (discard: boolean) => void = () => {}

	function confirmDiscard(): boolean | Promise<boolean> {
		if (!modalDirty()) return true
		setDiscardOpen(true)
		return new Promise((resolve) => {
			answerDiscard = (discard) => {
				setDiscardOpen(false)
				resolve(discard)
			}
		})
	}

	function closeRename(): void {
		setModalOpen(false)
		setModalDirty(false)
	}

	function saveFilters(next: FilterTableSavedFilter[]): void {
		localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(next))
		setSavedFilters(next)
	}

	const [columnOrder, setColumnOrder] = createSignal<string[]>(
		JSON.parse(localStorage.getItem(COLUMN_ORDER_KEY) ?? '[]'),
	)

	function saveColumnOrder(next: string[]): void {
		localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(next))
		setColumnOrder(next)
	}

	const [columnWidths, setColumnWidths] = createSignal<Record<string, number>>(
		JSON.parse(localStorage.getItem(COLUMN_WIDTHS_KEY) ?? '{}'),
	)

	function saveColumnWidths(next: Record<string, number>): void {
		localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(next))
		setColumnWidths(next)
	}

	const onHashChange = () => {
		setPage(readPage())
		window.scrollTo(0, 0)
	}
	window.addEventListener('hashchange', onHashChange)
	onCleanup(() => window.removeEventListener('hashchange', onHashChange))

	return (
		<div class="layout">
			<nav class="sidebar" aria-label="Examples">
				<strong class="sidebar-title">Solid Components</strong>
				<ul>
					<For each={pages}>
						{(item) => (
							<li>
								<a
									href={`#${item.id}`}
									aria-current={page() === item.id ? 'page' : undefined}
								>
									{item.label}
								</a>
							</li>
						)}
					</For>
				</ul>
			</nav>
			<main classList={{ wide: page() === 'filter-table' }}>
				<Switch>
					<Match when={page() === 'data-table'}>
						<h1>DataTable example</h1>
						<p>Sorting, custom cells, actions, loading, and empty states.</p>

						<div class="actions">
							<button type="button" onClick={() => setLoading((value) => !value)}>
								{loading() ? 'Hide loading' : 'Show loading'}
							</button>
							<button type="button" onClick={() => setEmpty((value) => !value)}>
								{empty() ? 'Show rows' : 'Show empty state'}
							</button>
						</div>

						<section class="table-card">
							<header class="table-header">
								<div>
									<h2>Products</h2>
									<p>Manage your inventory and availability.</p>
								</div>
								<span class="count">{products.length} items</span>
							</header>
							<DataTable
								rows={() => (empty() || loading() ? [] : products)}
								columns={columns}
								getRowId={(product) => product.id}
								defaultSort={{ key: 'name', direction: 'asc' }}
								showColumnCustomizer
								resizableColumns
								loading={loading}
								emptyContent={<p class="table-message">No products found.</p>}
								getCell={(product, column) =>
									column.key === 'stock' && product.stock === 0 ? (
										<span class="out-of-stock">Out of stock</span>
									) : (
										(column.getValue?.(product) ?? null)
									)
								}
								rowActions={(product) => (
									<button type="button" aria-label={`Edit ${product.name}`}>
										Edit
									</button>
								)}
							/>
						</section>

						<h2>Server-side pagination</h2>
						<p>
							Sorting and paging request one page at a time from a simulated backend,
							with a sticky header and actions column.
						</p>

						<section class="table-card">
							<ServerSideTable />
						</section>

						<h2>Minimal</h2>
						<p>
							Only <code>rows</code>, <code>columns</code>, and <code>getRowId</code>:
							no sorting, actions, column customizer, or resizing.
						</p>

						<section class="table-card">
							<DataTable
								rows={products}
								columns={minimalColumns}
								getRowId={(product) => product.id}
							/>
						</section>
					</Match>
					<Match when={page() === 'filter-table'}>
						<h1>FilterTable example</h1>
						<p>
							Device inventory: quick search, a grouped filter form, removable filter
							pills, saved filters, and column order and widths (kept in
							localStorage).
						</p>

						<section class="table-card filter-table-demo">
							<FilterTable
								rows={devices}
								columns={deviceColumns}
								filters={deviceFilters}
								getRowId={(device) => device.id}
								getCell={deviceCell}
								filterValues={filterValues}
								onFilterValuesChange={setFilterValues}
								savedFilters={savedFilters}
								onSavedFiltersChange={saveFilters}
								columnOrder={columnOrder}
								onColumnOrderChange={saveColumnOrder}
								columnWidths={columnWidths}
								onColumnWidthsChange={saveColumnWidths}
								defaultSort={{ key: 'name', direction: 'asc' }}
								showColumnCustomizer
								resizableColumns
								emptyContent={
									<p class="table-message">No devices match the filters.</p>
								}
							/>
						</section>
						<p>
							Filter values: <code>{JSON.stringify(filterValues())}</code>
						</p>
					</Match>
					<Match when={page() === 'combobox'}>
						<h1>Combobox example</h1>
						<p>
							Type to filter, arrow keys to move, Enter to pick, Escape to close. Tab
							moves on to the next field.
						</p>

						<section class="combobox-demo">
							<label for="product-combobox">Product</label>
							<Combobox
								id="product-combobox"
								value={product()}
								onChange={setProduct}
								options={productOptions}
								emptyLabel="No product"
								onAdd={(query) => setAdded(query)}
								addLabel="Add product"
							/>
							<label for="quantity-input">Quantity</label>
							<input id="quantity-input" type="number" min="1" value="1" />
							<p>
								Selected value: <code>{product() || '(none)'}</code>
								<Show when={added() !== undefined}>
									{' '}
									· Add requested with name <code>{added() || '(empty)'}</code>
								</Show>
							</p>
						</section>
					</Match>
					<Match when={page() === 'modal'}>
						<h1>Modal example</h1>
						<p>
							Close with Escape, a backdrop click, the close button, or the form
							buttons. With unsaved changes, <code>onBeforeClose</code> asks first.
						</p>

						<section class="modal-demo">
							<button type="button" onClick={() => setModalOpen(true)}>
								Rename product
							</button>
							<p>
								Name: <code>{modalName()}</code>
							</p>
							<Modal
								open={modalOpen()}
								onBeforeClose={confirmDiscard}
								onClose={closeRename}
								title="Rename product"
								footer={
									<>
										<button
											type="button"
											onClick={async () => {
												// Skips onBeforeClose when closed directly, so ask here too.
												if (await confirmDiscard()) closeRename()
											}}
										>
											Cancel
										</button>
										<button type="submit" form="rename-form">
											Save
										</button>
									</>
								}
							>
								<form
									id="rename-form"
									class="modal-demo-form"
									onSubmit={(e) => {
										e.preventDefault()
										const name = new FormData(e.currentTarget).get('name')
										setModalName(String(name))
										closeRename()
									}}
								>
									<label for="rename-input">Name</label>
									<input
										id="rename-input"
										name="name"
										value={modalName()}
										autofocus
										onInput={(e) => {
											setModalDirty(e.currentTarget.value !== modalName())
										}}
									/>
								</form>
							</Modal>
							<Modal
								open={discardOpen()}
								onClose={() => answerDiscard(false)}
								title="Discard changes?"
								hideCloseButton
								footer={
									<>
										<button type="button" onClick={() => answerDiscard(false)}>
											Keep editing
										</button>
										<button type="button" onClick={() => answerDiscard(true)}>
											Discard
										</button>
									</>
								}
							>
								Your new name hasn't been saved.
							</Modal>
						</section>
					</Match>
					<Match when={page() === 'search-bar'}>
						<h1>SearchBar example</h1>
						<p>Press Ctrl/Cmd+K anywhere to focus the search.</p>

						<section class="search-bar-demo">
							<SearchBar value={search()} onInput={setSearch} />
							<p>
								Query: <code>{search() || '(empty)'}</code>
							</p>
						</section>
					</Match>
					<Match when={page() === 'color-input'}>
						<h1>ColorInput example</h1>
						<p>Type a hex value or use the color picker.</p>

						<section class="color-input-demo">
							<ColorInput value={color()} onInput={setColor} />
							<p>
								Value: <code>{color()}</code>
							</p>
						</section>
					</Match>
				</Switch>
			</main>
		</div>
	)
}
