import { createMemo, createSignal, Show } from 'solid-js'
import { DataTable, type DataTableColumn, type DataTableSortDirection } from '../src'
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

export default function App() {
	const [selected, setSelected] = createSignal<number[]>([])
	const [sortKey, setSortKey] = createSignal<string | undefined>('name')
	const [sortDirection, setSortDirection] = createSignal<DataTableSortDirection>('asc')
	const [loading, setLoading] = createSignal(false)
	const [empty, setEmpty] = createSignal(false)

	const sortedProducts = createMemo(() => {
		const key = sortKey()
		if (!key) return products

		return [...products].sort((a, b) => {
			const result = String(a[key as keyof Product]).localeCompare(
				String(b[key as keyof Product]),
				undefined,
				{ numeric: true },
			)
			return sortDirection() === 'asc' ? result : -result
		})
	})

	function sort(key: string) {
		if (sortKey() === key) {
			setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'))
		} else {
			setSortKey(key)
			setSortDirection('asc')
		}
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
					rows={() => (empty() ? [] : sortedProducts())}
					columns={columns}
					getRowId={(product) => product.id}
					selected={selected}
					onSelectionChange={(ids) => setSelected(ids.map(Number))}
					sortKey={sortKey}
					sortDirection={sortDirection}
					onSort={sort}
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
		</main>
	)
}
