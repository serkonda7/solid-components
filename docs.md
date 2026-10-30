# solid-components docs

Full API and internals. Install and component list: `README.md`. Live usage of
every feature: `examples/App.tsx`.

## DataTable

Doesn't fetch or navigate; the consumer provides rows and callbacks. Reactive
props accept `T | Accessor<T>`. Cell content: `getCell` → `column.getValue` → `null`.

```tsx
<DataTable
  rows={items}
  getRowId={(item) => item.id}
  columns={[{ key: 'name', label: 'Name', sortable: true }]}
  defaultSort={{ key: 'name', direction: 'asc' }}
  getCell={(item, column) => column.key === 'name' ? item.name : null}
/>
```

No built-in row selection: render checkboxes in `getCell`, keep ids in the consumer.

### Sorting
`sortable: true` headers cycle `asc` → `desc` → unsorted.

- Uncontrolled: the table sorts `rows`, starting from `defaultSort`. Values come
  from `column.sortValue(row)`, else `row[column.key]`; numbers compare
  numerically, the rest via `localeCompare` with `numeric: true`,
  `null`/`undefined` first.
- Controlled (`sortKey` or `sortDirection` set): the consumer sorts `rows`.
  Sort buttons need `onSort(key)` (consumer cycles) or `onSortChange(sort | undefined)`.
- `onSortClear` fires on reaching unsorted. All callbacks also fire uncontrolled.

### Column customizer
`showColumnCustomizer` adds a "Columns" dialog: checkboxes, plus reordering by
drag or Alt+ArrowUp/Down.

- Per column: `toggleable: false` (always shown), `defaultVisible: false`.
- Visibility: `defaultVisibleColumns`, or controlled with `visibleColumns` +
  `onVisibleColumnsChange`.
- Order: `defaultColumnOrder`, or controlled with `columnOrder` +
  `onColumnOrderChange`. Missing columns are appended; unknown keys ignored.
- `Reset` restores default visibility and order and clears widths.
- Labels: `columnCustomizerLabel`, `columnCustomizerTitle`,
  `columnCustomizerShowAllLabel`, `columnCustomizerResetLabel`.

### Column widths
`resizableColumns` adds handles: drag, ArrowLeft/Right, or double-click/Enter to
fit content.

- `onColumnWidthsChange` receives pixel widths of all visible columns after each
  resize (not during a drag) and `{}` on `Reset`.
- `columnWidths` restores, and may arrive after mount: each new value replaces the
  widths, `{}` returns to automatic layout. Not strict control: resizing works
  without passing the result back. Columns without a width are fitted to content.
- Saved widths ignore the column's `minWidth`/`maxWidth`.

### Sticky, loading
- `stickyHeader` scrolls the table inside a viewport capped by
  `--data-table-max-height` (default `80dvh`).
- `stickyActions` pins the `rowActions` column right.
- Sticky cells are opaque: set `--data-table-bg` and `--data-table-header-bg` to
  your surface, and keep `--data-table-row-hover-bg` opaque with `stickyActions`.
- `loading` without rows shows `skeletonRows` (default 5) skeletons; with rows it
  keeps them and shows a status below. `loadingContent` replaces both.

### Pagination
Server-side only: `rows` holds just the current page.

```tsx
<DataTable
  rows={pageRows}
  columns={columns}
  getRowId={(item) => item.id}
  sortKey={() => sort()?.key}
  sortDirection={() => sort()?.direction ?? 'asc'}
  onSortChange={(next) => { setSort(next); setPaging({ ...paging(), page: 1 }) }}
  pagination={() => ({ ...paging(), rowCount: total(), pageSizeOptions: [25, 50, 100] })}
  onPaginationChange={setPaging}
  loading={loading}
/>
```

- `page` is 1-based; `rowCount` is the total across pages.
- `onPaginationChange({ page, pageSize })` only reports; update `pagination` in
  response. A page size change reports page 1.
- Use controlled sorting, or only the current page gets sorted. Resetting the page
  after a sort or filter change, or when it no longer exists, is up to the consumer.
- With `FilterTable`, set `manualFiltering`; `pagination.rowCount` feeds the Results
  badge, or pass `totalCount` to override it.
- Omitting `pageSizeOptions` hides the select. Texts: `paginationLabels`
  (`navigation`, `previous`, `next`, `pageSize`, `range(first, last, rowCount)`).

## FilterTable

Wraps `DataTable` (all props pass through) in Results/Filters tabs.

```tsx
const filters: FilterTableFilter<Device>[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'site', label: 'Site', type: 'select', group: 'Location', options: siteOptions },
  { key: 'active', label: 'Active', type: 'boolean', getValue: (d) => d.status === 'active' },
  { key: 'ports', label: 'Ports', type: 'number-range' },
  { key: 'seen', label: 'Last seen', type: 'date-range' },
]

<FilterTable rows={devices} columns={columns} filters={filters} getRowId={(d) => d.id} />
```

- Filter types: `text` (case-insensitive substring), `select` (multi-select, matches
  any value, row values may be arrays, `options` default to distinct row values),
  `boolean` (against `Boolean(value)`), `number-range`, `date-range` (inclusive; row
  values may be a `Date`, timestamp, or date string, compared by local day; rows
  without a value never match). Values: `getValue(row)`, else `row[key]`.
  `match(row, value)` replaces the built-in matching.
- Range values are strings: `min..max`, either bound may be empty (`10..`, `..20`),
  dates as `YYYY-MM-DD`. `parseFilterTableRange(value)` returns `{ min, max }`.
  `formatValue(bound)` on the filter formats bounds in the pills.
- Filter form edits stay a draft until "Search"/Enter. "Reset" keeps the quick search.
- Quick search matches `getSearchText(row)`, default the column values; hide it
  with `quickSearch={false}`. `quickSearchDebounce` (ms, default 300 with
  `manualFiltering`, else 0) delays applying it; Enter applies at once.
- State is `FilterTableValues`: `{ [filterKey]: string | string[], q }`, inactive
  filters omitted, so it maps onto URL params. Use `defaultFilterValues`, or
  control with `filterValues`. `onFilterValuesChange` always fires.
- `manualFiltering` passes `rows` through, for server-side filtering. Derived `select`
  options then accumulate over the rows seen, so they don't shrink but only hold
  loaded values; pass `options` for the full list.
- The Results badge shows `totalCount`, else `pagination.rowCount`, else the rows
  shown. Pass `totalCount` for `manualFiltering` without `pagination`.
- Saved filters: pass `savedFilters` (`{ name, values }[]`, even `[]`) +
  `onSavedFiltersChange`. Saving replaces an entry of the same name. Persistence
  and deletion are up to the consumer.
- Texts: `quickSearchLabel`, `resultsLabel`, `filtersLabel`, `applyLabel`,
  `resetLabel`, `clearAllLabel`, `anyLabel`, `yesLabel`, `noLabel`,
  `fromLabel`, `toLabel`, `savedFiltersLabel`, `saveLabel`, `saveNameLabel`, `cancelLabel`,
  `clearSavedFilterLabel`.

## Combobox

Searchable single-select. Renders only the control: pair it with `<label for={id}>`
or pass `ariaLabel`.

```tsx
<Combobox
  id="site"
  value={siteId()}            // string; '' = nothing / the empty entry
  onChange={setSiteId}        // omit for read-only
  options={sites().map((s) => ({ value: s.id, label: s.name, detail: s.region, icon: IconMapPin }))}
  emptyLabel="None"           // optional leading '' entry
  onOpen={refetchSites}       // runs on every open
  onAdd={(query) => navigate(`/sites/add?name=${encodeURIComponent(query)}`)}
  addLabel="Add Site"
/>
```

- Typing filters `label` and `detail`. Escape stops propagation, so enclosing
  dialogs stay open.
- `onAdd` pins an add entry last and receives the trimmed search text.
- Option `icon` is any `Component<{ size?: number }>`. `preview` is a `Component`
  shown beside the list while the option is highlighted; it is `aria-hidden`, so
  the label must still name the option.
- Texts: `placeholder`, `searchLabel` (`Search`), `noMatchesLabel`
  (`No matching objects`), `addLabel` (`Add`).
- The value is mirrored in the input's `data-value`.

## SearchBar

Controlled search input with a clear button and global Ctrl/Cmd+K focus.

```tsx
<SearchBar value={query()} onInput={setQuery} ariaLabel="Search books" />
```

- `shortcutKey` changes the key; `false` disables shortcut and hint.
  `shortcutLabel` overrides the hint, which is hidden on `(pointer: coarse)`.
- Texts: `ariaLabel` (`Search`), `placeholder` (`Search…`), `clearLabel`
  (`Clear search`).
- `class` is added to `.search-bar`.

## Modal

Controlled, on native `<dialog>` (`showModal()`). Content is mounted only while `open`.

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

- Focus goes to the first `autofocus`, else first focusable element (the close
  button), and returns on close.
- Escape, backdrop click and close button call `onClose`; only `open` closes it.
  Disable with `closeOnEscape={false}`, `closeOnBackdrop={false}`, `hideCloseButton`.
  `<form method="dialog">` also calls `onClose`.
- `onBeforeClose` guards those three triggers: return `false` or a promise (e.g.
  ask in a second `Modal`); a rejection keeps it open, further requests are ignored
  while pending. It doesn't get the reason; to treat a trigger differently, disable
  it reactively (`closeOnBackdrop={!dirty()}`).
- Not guarded: setting `open` false yourself, and native closes, as the `<dialog>`
  is already closed when `onClose` fires, so forms with pending changes must not
  use `<form method="dialog">`. Repeated browser close requests (Android back) may
  bypass a veto. Page unload needs the consumer's `beforeunload`.
- Naming: `title` renders an `<h2>` and labels the dialog; else pass `ariaLabel`.
  Also `describedBy`, `closeLabel` (`Close`).
- Locks page scroll. Width via `--modal-width` (default `32rem`); `class` is added
  to `<dialog class="modal">`.

## Vite plugin (`src/vite.ts`)

`tablerIcons()` is for apps importing `@tabler/icons-solidjs` themselves; `dist/`
already bundles the components' icons. `vite-plugin-solid` adds the `solid` export
condition, which resolves to the source barrel (~6000 dev requests).

- Rewrites named icon imports to per-icon default imports (dev and build), resolved
  from each importer; `type` specifiers are dropped.
- Never falls back to the barrel: namespace/default/dynamic imports, re-exports,
  and unknown names fail the transform, and in dev so does any other resolution of
  the package root. Don't add an alias or `vite-plugin-entry-shaking` alongside it.
- Runs in Node: `scripts/build.ts` bundles it separately into `dist/vite.js`.
  `vite` is an optional peer dependency.

## Add a component

- Export it from `src/index.ts`, style it in `src/`, add a demo to `examples/App.tsx`.
- Never edit `dist/`.
- No new runtime deps. SolidJS is an external peer dep, `@tabler/icons-solidjs` a
  dev dep bundled into `dist/`, `@tanstack/solid-table` an external dependency.

## Invariants

### DataTable (`src/data-table.tsx`)
- TanStack Table owns the row model and sorting, visibility, order, and sizing
  logic; its state derives from public props, `on*Change` maps back to callbacks. No
  TanStack type is public API. Pagination is plain props: the row model never pages.
- Sorting, visibility, and order are controlled table state: read `table.atoms` or
  those memos, not TanStack's defaults.
- Sizing is the table's own state, empty until the first resize or restore, because
  `width` props may be CSS lengths. `columnWidths` writes into it, so a drag updates
  live while `onColumnWidthsChange` fires only at the end.
- `fitColumn` measures clones in an offscreen table, since cells in place can't
  report less than their current width. Clear `extraWidth` before the sizing, or
  the fit effect refills the emptied columns.
- The resize gesture is custom: `columnResizingFeature` has no keyboard path and
  pins on mousedown.
- Unwrap reactive props via `read()`; don't call them directly.
- Visibility state drops unknown keys and omits `toggleable: false` columns; output
  follows `columns` order.
- Order state always lists every column, `toggleable: false` included. Alt+Arrow
  restores focus after reordering; a `toggleable: false` item focuses its grip, as
  its checkbox is disabled. The touch drag listens on `document` because reordering
  can detach the grip.
- Header markup must not change size with sort state; keep the fixed-width
  `.data-table-sort-indicator`.
- Empty shows only when `!loading && (empty ?? rows.length === 0)`.
- The toolbar row shows when `toolbar` or the customizer is present.
- The customizer panel dismisses on outside `pointerdown` and `Escape`; keep both
  listeners paired, with cleanup.

### FilterTable (`src/filter-table.tsx`)
- Filtering runs in a headless TanStack table with one column per filter, plus a
  search column the global filter targets.
- `match` and `getSearchText` run in memoized row models, so signals they read don't
  re-filter; reactive inputs belong in `rows` or `filterValues`.
- `q` is reserved for the quick search; don't use it as a filter key.
- Values are normalized (trimmed, empties dropped) before being stored or emitted.
- Both tab panels stay mounted (`hidden`) to keep table state across tab switches.
- Quick search and pills render in `DataTable`'s `toolbar` slot.

### Combobox (`src/combobox.tsx`)
- Option ids are `${id}-option-${index}` over the filtered list; the add entry takes
  index `filtered.length`.
- Options `preventDefault` on `mousedown` so input blur doesn't close the list
  before the click lands.
- `onInput` reads the typed value before opening: opening resets the bound value.

### SearchBar (`src/search-bar.tsx`)
- The `document` keydown listener ignores Shift/Alt combinations so it doesn't
  shadow other bindings.
- The hint and clear button share the trailing slot; only one renders at a time.

## Styling (`src/styles.css`)

Theme via CSS vars with fallbacks and `light-dark()`. `color-scheme` is inherited
from the consumer; don't set it here.

- `--data-table-*`: `border`, `bg`, `header-bg`, `row-hover-bg`, `skeleton-bg`,
  `max-height`, `customizer-bg`, `customizer-hover-bg`, `panel-bg`
- `--filter-table-*`: `border`, `bg`, `muted`, `accent`, `pill-bg`
- `--combobox-*`: `border`, `bg`, `panel-bg`, `hover-bg`, `muted`, `accent`
- `--search-bar-*`: `border`, `bg`, `muted`, `hover-bg`

## Verify

Run the gates from `.github/workflows/ci.yml`; script names are in `package.json`.
Tests run in headless Chromium (`bunx playwright install chromium` once) because they
measure real layout. Keep `aria-sort`, dialog, and checkbox label semantics when
touching table markup.
