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
dialog listing every column as a checkbox:

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
- `Show all` / `Reset` restore all columns or the defaults.
- Labels can be customized via `columnCustomizerLabel`, `columnCustomizerTitle`,
  `columnCustomizerShowAllLabel`, and `columnCustomizerResetLabel`.

Full interactive coverage (sort, selection, custom cells, actions, loading, empty):
`examples/App.tsx`.

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
  wrap around and include the add entry; Enter picks, Escape closes (and stops
  propagation so enclosing dialogs stay open). Focus never leaves the input; the
  highlight is exposed via `aria-activedescendant` and kept scrolled into view.
- `onAdd` pins an add entry at the end of the list and receives the trimmed search text.
- Texts: `searchLabel` (open placeholder, default `Search`), `noMatchesLabel`
  (default `No matching objects`), `addLabel` (default `Add`).
- Options with `detail` render in two columns; `icon` is any
  `Component<{ size?: number }>` (e.g. a tabler icon), also shown in the closed input.
- The current value is mirrored in the input's `data-value` attribute.

## Add a component
- Export it from `src/index.ts`; it is the package entry (`vite.config.ts` uses it).
- Co-locate styles in `src/`; `scripts/build.ts` copies `src/styles.css` to `dist/`.
  Never edit `dist/` by hand.
- Add a demo to `examples/App.tsx`.
- No new runtime deps; use SolidJS and `@tabler/icons-solidjs` for icons (both are
  peer deps and listed as `external` in `vite.config.ts`).

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
- Header markup must not change size with sort state; keep the fixed-width
  `.data-table-sort-indicator` (covered by `src/data-table.test.tsx`).
- Empty shows only when `!loading && (empty ?? rows.length === 0)`.
- Customizer panel dismisses on outside `pointerdown` and `Escape` with cleanup in
  `createEffect`; keep both listeners paired.

## Combobox invariants (`src/combobox.tsx`)
- Option ids are `${id}-option-${index}` over the filtered list; the add entry takes
  index `filtered.length`. Options `preventDefault` on `mousedown` so the input's
  blur doesn't close the list before the click lands.
- `onInput` reads the typed value before opening: opening resets the bound value.

## Styling contract (`src/styles.css`)
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
