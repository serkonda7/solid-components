import { IconBulb, IconPlant, IconSpeakerphone } from '@tabler/icons-solidjs'
import { createSignal, Show } from 'solid-js'
import {
	Combobox,
	type ComboboxOption,
	DataTable,
	type DataTableColumn,
	FilterTable,
	type FilterTableSavedFilter,
	type FilterTableValues,
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

const categoryIcons = { Lighting: IconBulb, Decor: IconPlant, Audio: IconSpeakerphone }

const productOptions: ComboboxOption[] = products.map((product) => ({
	value: product.id,
	label: product.name,
	detail: product.category,
	icon: categoryIcons[product.category as keyof typeof categoryIcons],
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

const SAVED_FILTERS_KEY = 'solid-components-example-saved-filters'

export default function App() {
	const [selected, setSelected] = createSignal<number[]>([])
	const [loading, setLoading] = createSignal(false)
	const [empty, setEmpty] = createSignal(false)
	const [product, setProduct] = createSignal('')
	const [added, setAdded] = createSignal<string>()
	const [search, setSearch] = createSignal('')
	const [filterValues, setFilterValues] = createSignal<FilterTableValues>({})
	const [savedFilters, setSavedFilters] = createSignal<FilterTableSavedFilter[]>(
		JSON.parse(localStorage.getItem(SAVED_FILTERS_KEY) ?? '[]'),
	)

	function saveFilters(next: FilterTableSavedFilter[]): void {
		localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(next))
		setSavedFilters(next)
	}

	return (
		<main>
			<h1>DataTable example</h1>
			<p>Sorting, selection, custom cells, actions, loading, and empty states.</p>

			<div class="actions">
				<button type="button" onClick={() => setLoading((value) => !value)}>
					{loading() ? 'Hide loading' : 'Show loading'}
				</button>
				<button type="button" onClick={() => setEmpty((value) => !value)}>
					{empty() ? 'Show rows' : 'Show empty state'}
				</button>
				<Show when={selected().length > 0}>
					<button type="button" onClick={() => setSelected([])}>
						Clear selection ({selected().length})
					</button>
				</Show>
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
					rows={() => (empty() ? [] : products)}
					columns={columns}
					getRowId={(product) => product.id}
					selected={selected}
					onSelectionChange={(ids) => setSelected(ids.map(Number))}
					defaultSort={{ key: 'name', direction: 'asc' }}
					showColumnCustomizer
					loading={loading}
					loadingContent={<p class="table-message">Loading products…</p>}
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

			<h1>FilterTable example</h1>
			<p>
				Device inventory: quick search, a grouped filter form, removable filter pills, and
				saved filters (kept in localStorage).
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
					defaultSort={{ key: 'name', direction: 'asc' }}
					showColumnCustomizer
					emptyContent={<p class="table-message">No devices match the filters.</p>}
				/>
			</section>
			<p>
				Filter values: <code>{JSON.stringify(filterValues())}</code>
			</p>

			<h1>Combobox example</h1>
			<p>Type to filter, arrow keys to move, Enter to pick, Escape to close.</p>

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
				<p>
					Selected value: <code>{product() || '(none)'}</code>
					<Show when={added() !== undefined}>
						{' '}
						· Add requested with name <code>{added() || '(empty)'}</code>
					</Show>
				</p>
			</section>

			<h1>SearchBar example</h1>
			<p>Press Ctrl/Cmd+K anywhere to focus the search.</p>

			<section class="search-bar-demo">
				<SearchBar value={search()} onInput={setSearch} />
				<p>
					Query: <code>{search() || '(empty)'}</code>
				</p>
			</section>
		</main>
	)
}
