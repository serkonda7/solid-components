# Agent Docs — solid-components

Start with `README.md` (minimal usage), `examples/App.tsx` + `examples/README.md`
(demo), `package.json` (scripts), `.github/workflows/ci.yml` (gates). This file
covers the full API plus what those omit.

## DataTable usage

See `README.md` for the component list. `DataTable` does not fetch data or perform
navigation. Consumers provide the rows, cell rendering, and callbacks:

```tsx
<DataTable
  rows={items}
  getRowId={(item) => item.id}
  columns={[{ key: 'name', label: 'Name', sortable: true }]}
  defaultSort={{ key: 'name', direction: 'asc' }}
  getCell={(item, column) => column.key === 'name' ? item.name : null}
/>
```

### Sorting
Mark columns with `sortable: true`. Clicking a header cycles `asc` → `desc` →
unsorted; clicking another header starts it at `asc`.

- Uncontrolled by default: the table sorts `rows` itself. Set the initial state
  with `defaultSort`. Values come from `column.sortValue(row)`, falling back to
  `row[column.key]`; numbers compare numerically, everything else via
  `localeCompare` with `numeric: true`, `null`/`undefined` first.
- Controlled when `sortKey` or `sortDirection` is passed: the table only renders
  the sort state and passes `rows` through unchanged, so the consumer must sort
  them. Handle clicks with `onSort(key)` (fires on every click; the consumer
  cycles) or `onSortChange(sort | undefined)` (receives the next state).
- `onSortClear` additionally fires when the cycle reaches unsorted. All sort
  callbacks also fire in uncontrolled mode.
- Sorting never changes column widths: the arrow slot has a fixed width.

### Column customizer
Opt in with `showColumnCustomizer`. The table renders a "Columns" button with a
dialog listing every column as a checkbox, in display order. Columns are
reordered by dragging an item or with its move up/down buttons:

```tsx
const columns = [
  { key: 'name', label: 'Name', toggleable: false }, // always shown
  { key: 'price', label: 'Price', defaultVisible: false }, // hidden initially
]

<DataTable rows={items} getRowId={(item) => item.id} columns={columns} showColumnCustomizer />
```

- Uncontrolled by default; use `defaultVisibleColumns` for the initial state.
- Controlled with `visibleColumns` + `onVisibleColumnsChange` to persist the
  selection
- Order is uncontrolled by default; use `defaultColumnOrder` (column keys) for the
  initial order. Controlled with `columnOrder` + `onColumnOrderChange`. Columns
  missing from the order are appended in `columns` order; unknown keys are ignored.
- `Show all` restores all columns; `Reset` restores the default visibility and order.
- Labels can be customized via `columnCustomizerLabel`, `columnCustomizerTitle`,
  `columnCustomizerShowAllLabel`, and `columnCustomizerResetLabel`.
- `FilterTable` passes all of these through to its `DataTable`.

Full interactive coverage (sort, selection, custom cells, actions, loading, empty):
`examples/App.tsx`.

## FilterTable usage

`FilterTable` wraps `DataTable` (all its props pass through) in
Results/Filters tabs:

```tsx
const filters: FilterTableFilter<Device>[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'site', label: 'Site', type: 'select', group: 'Location', options: siteOptions },
  { key: 'active', label: 'Active', type: 'boolean', getValue: (d) => d.status === 'active' },
]

<FilterTable rows={devices} columns={columns} filters={filters} getRowId={(d) => d.id} />
```

- Results tab: quick search input (filters as you type; `quickSearch={false}`
  hides it), one removable pill per applied value plus "Clear all", then the
  table. Its badge shows the result count.
- Filters tab: a form with one section per `group` (ungrouped first) under a muted
  heading, separated by thin rules; labels sit in a fixed-width column. Edits stay a draft until "Search" (or Enter) applies them
  and returns to Results; "Reset" clears all filters but keeps the quick search.
  Its badge counts the applied filters.
- Filter types: `text` (case-insensitive substring), `select` (multi-select via
  `Combobox` + chips; matches any chosen value, row values may be arrays;
  `options` default to the distinct row values), `boolean` (Any/Yes/No, matched
  against `Boolean(value)`). Values come from `getValue(row)`, falling back to
  `row[key]`; `match(row, value)` replaces the built-in matching.
- Quick search matches `getSearchText(row)`, by default the rows' column values
  (`sortValue` or `row[column.key]`).
- State is a `FilterTableValues` record: `{ [filterKey]: string | string[], q }`
  with inactive filters omitted, so it maps onto URL query params. Uncontrolled
  by default (`defaultFilterValues`); controlled with `filterValues` +
  `onFilterValuesChange`. `onFilterValuesChange` also fires when uncontrolled.
- `manualFiltering` passes `rows` through unchanged, for server-side filtering.
- Saved filters (modelled on NetBox): pass `savedFilters` (`{ name, values }[]`,
  even `[]`) with `onSavedFiltersChange`. A "Save" pill after "Clear all" opens
  an inline name input; saving stores the applied values (quick search included)
  and replaces an entry of the same name. A "Saved filters" picker beside the
  quick search applies one (replacing the applied values) and shows the saved
  filter equal to the applied values, with a clear button that, like "Clear all",
  clears the filters but keeps the quick search and the saved filter. Persisting
  the list (localStorage, backend) and deleting entries are up to the consumer.
- Texts: `quickSearchLabel`, `resultsLabel`, `filtersLabel`, `applyLabel`
  (`Search`), `resetLabel`, `clearAllLabel`, `anyLabel`, `yesLabel`, `noLabel`,
  `savedFiltersLabel`, `saveLabel`, `saveNameLabel`, `cancelLabel`,
  `clearSavedFilterLabel`.

## Combobox usage

Searchable single-select. It renders only the control, so pair it with your own
`<label for={id}>` (or pass `ariaLabel`):

```tsx
<label for="site">Site</label>
<Combobox
  id="site"
  value={siteId()}            // string; '' = nothing / the empty entry
  onChange={setSiteId}        // omit for read-only
  options={sites().map((s) => ({ value: s.id, label: s.name, detail: s.region, icon: IconMapPin }))}
  emptyLabel="None"           // optional leading '' entry
  onOpen={refetchSites}       // optional, runs on every open
  onAdd={(query) => navigate(`/sites/add?name=${encodeURIComponent(query)}`)}
  addLabel="Add Site"
/>
```

- Typing filters by `label` and `detail` (case-insensitive substring). Arrow keys
  wrap around and include the add entry; Enter picks, Tab picks and lets focus
  move on (on the add entry it only closes), Escape closes (and stops
  propagation so enclosing dialogs stay open). Focus never leaves the input; the
  highlight is exposed via `aria-activedescendant` and kept scrolled into view.
- `onAdd` pins an add entry at the end of the list and receives the trimmed search text.
- Texts: `placeholder` (closed and empty, after `emptyLabel`), `searchLabel` (open placeholder, default `Search`), `noMatchesLabel`
  (default `No matching objects`), `addLabel` (default `Add`).
- Options with `detail` render in two columns; `icon` is any
  `Component<{ size?: number }>` (e.g. a tabler icon), also shown in the closed input.
- `preview` is a `Component` rendered in a panel beside the open list while its
  option is highlighted (by hover or arrow keys); `aria-hidden`, so the label
  must still name the option.
- The current value is mirrored in the input's `data-value` attribute.

## SearchBar usage

Controlled search input with a leading icon, a clear button while filled, and a
global shortcut hint:

```tsx
<SearchBar value={query()} onInput={setQuery} ariaLabel="Search books" placeholder="Search…" />
```

- Ctrl/Cmd+K anywhere on the page focuses and selects the input (`preventDefault`
  stops the browser's own binding). Change the key with `shortcutKey`; `false`
  disables the shortcut, the hint and `aria-keyshortcuts`.
- While empty a `<kbd>` hint (`Ctrl K`, override with `shortcutLabel`) fills the
  trailing slot; it is hidden on `(pointer: coarse)` devices. While filled the
  clear button replaces it and calls `onInput('')`.
- Texts: `ariaLabel` (default `Search`), `placeholder` (default `Search…`),
  `clearLabel` (default `Clear search`).
- `class` is added to the wrapper (`.search-bar`), e.g. to cap its width.

## Modal usage

Controlled modal dialog built on a native `<dialog>` (`showModal()`). Its
content is mounted only while `open`:

```tsx
<Modal
  open={editing()}
  onClose={() => setEditing(false)}
  title="Edit device"
  footer={<button type="button" onClick={save}>Save</button>}
>
  <input aria-label="Name" autofocus />
</Modal>
```

- Focus: the modal sits in the top layer and the page behind is inert, so focus
  can't leave it. Opening focuses the first `autofocus` element, else the first
  focusable one (the close button); closing returns focus to the element that
  had it before.
- Closing: Escape, a click on the backdrop (only when the press also started
  there, so dragging a selection out of the panel doesn't close) and the header
  close button call `onClose`; the modal itself only closes through `open`.
  Disable them with `closeOnEscape={false}`, `closeOnBackdrop={false}`,
  `hideCloseButton`. A native close (`<form method="dialog">`) also calls
  `onClose`. Escape handled inside (e.g. by an open `Combobox`) doesn't reach it.
- Naming: `title` renders an `<h2>` and labels the dialog; without it pass
  `ariaLabel`. `describedBy` sets `aria-describedby`. `closeLabel` defaults to
  `Close`.
- Page scroll is locked while a modal is open. Width via `--modal-width`
  (default `32rem`); `class` is added to the `<dialog class="modal">`.

## Vite plugin (`@serkonda7/solid-components/vite`, `src/vite.ts`)

`tablerIcons()` is for apps that import `@tabler/icons-solidjs` themselves; the
components don't need it because `dist/` bundles their icons. `vite-plugin-solid`
adds the `solid` export condition, which resolves the package to its source
barrel: in dev that is ~6000 separate module requests and the page hangs.

```ts
import { tablerIcons } from '@serkonda7/solid-components/vite'
plugins: [tablerIcons(), solid()] // before solid()
```

- Rewrites `import { IconX, IconY as Y } from '@tabler/icons-solidjs'` to per-icon
  default imports (dev and build); `type` specifiers are dropped. The package is
  resolved from each importer, so it uses the app's own install.
- Never falls back to the barrel: namespace/default/dynamic imports, re-exports,
  and unknown names fail the transform. In dev, any other resolution of the
  package root is an error naming the importer, and the package is excluded from
  `optimizeDeps`. Don't add an alias or `vite-plugin-entry-shaking` alongside it.
- Runs in Node: `scripts/build.ts` bundles it with `Bun.build` into `dist/vite.js`,
  separate from the browser entry. `vite` is an optional peer dependency.

## Add a component
- Export it from `src/index.ts`; it is the package entry (`vite.config.ts` uses it).
- Co-locate styles in `src/`; `scripts/build.ts` copies `src/styles.css` to `dist/`.
  Never edit `dist/` by hand.
- Add a demo to `examples/App.tsx`.
- No new runtime deps; use SolidJS (a peer dep, `external` in `vite.config.ts`) and
  `@tabler/icons-solidjs` for icons (a dev dep, bundled into `dist/` so only
  the used icons ship).

## DataTable invariants (`src/data-table.tsx`)
- Reactive props accept `T | Accessor<T>`; unwrap via `read()` (`src/data-table.tsx:63`).
  Do not call the prop directly.
- Cell precedence: `getCell` → `column.getValue` → `null`.
- Sort buttons render for `column.sortable` columns; in controlled mode (`sortKey`
  or `sortDirection` set) only if `onSort` or `onSortChange` is set. The table
  sorts rows only when uncontrolled.
- Selection column renders only when both `selected` and `onSelectionChange` are set.
  Select-all uses an `indeterminate` effect on a ref; keep it when refactoring.
- Visibility state drops unknown keys and omits `toggleable: false` columns from
  tracking (they stay visible implicitly); output keys follow `columns` order.
- Order state (`columnOrder`) is separate from visibility and always lists every
  column key, `toggleable: false` columns included. Customizer move buttons
  restore focus after reordering (covered by `src/data-table.test.tsx`).
- Header markup must not change size with sort state; keep the fixed-width
  `.data-table-sort-indicator` (covered by `src/data-table.test.tsx`).
- Empty shows only when `!loading && (empty ?? rows.length === 0)`.
- `toolbar` content renders at the start of the toolbar row; the row shows when
  it or the customizer is present.
- Customizer panel dismisses on outside `pointerdown` and `Escape` with cleanup in
  `createEffect`; keep both listeners paired.

## FilterTable invariants (`src/filter-table.tsx`)
- The quick search lives under the reserved key `q`; do not use it as a filter key.
- Values are normalized (trimmed, empty strings/arrays dropped) before they are
  stored or emitted.
- Both tab panels stay mounted (`hidden`) so the table keeps its sort and column
  state across tab switches.
- Quick search and pills render in `DataTable`'s `toolbar` slot, beside the
  column customizer.

## Combobox invariants (`src/combobox.tsx`)
- Option ids are `${id}-option-${index}` over the filtered list; the add entry takes
  index `filtered.length`. Options `preventDefault` on `mousedown` so the input's
  blur doesn't close the list before the click lands.
- `onInput` reads the typed value before opening: opening resets the bound value.

## SearchBar invariants (`src/search-bar.tsx`)
- The keydown listener is registered on `document` in `onMount` and removed in
  `onCleanup`; it ignores Shift/Alt combinations so it doesn't shadow other bindings.
- The hint and the clear button share the trailing slot, so only one renders at a time.

## Styling contract (`src/styles.css`)
- FilterTable themes via `--filter-table-*` vars (`border`, `bg`, `muted`,
  `accent`, `pill-bg`) with the same fallback chain.
- SearchBar themes via `--search-bar-*` vars (`border`, `bg`, `muted`, `hover-bg`)
  with the same fallback chain.
- Combobox themes via `--combobox-*` vars (`border`, `bg`, `panel-bg`, `hover-bg`,
  `muted`, `accent`) with the same fallback chain.
- Theme via `--data-table-*` vars with fallbacks and `light-dark()`; `color-scheme`
  is inherited from the consumer, do not set it here.

## Verify
Tests (`src/**/*.test.tsx`) run in headless Chromium via Vitest browser mode, since
they measure real layout; install it once with `bunx playwright install chromium`.
Run the gate defined in `.github/workflows/ci.yml` using the script names in
`package.json`. Fix formatting with the write-mode lint script; keep `aria-sort`,
dialog, and checkbox label semantics when touching table markup.
