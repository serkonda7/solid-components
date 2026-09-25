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
Mark columns with `sortable: true`. Clicking a header toggles `asc` → `desc`;
the `×` button next to the active header clears sorting.

- Uncontrolled by default: the table sorts `rows` itself. Set the initial state
  with `defaultSort`. Values come from `column.sortValue(row)`, falling back to
  `row[column.key]`; numbers compare numerically, everything else via
  `localeCompare` with `numeric: true`, `null`/`undefined` first.
- Controlled when `sortKey` or `sortDirection` is passed: the table only renders
  the sort state and passes `rows` through unchanged, so the consumer must sort
  them. Handle clicks with `onSort(key)` or `onSortChange(sort)`; the clear button
  shows only if `onSortClear` or `onSortChange` is set.
- `onSort`, `onSortClear`, and `onSortChange(sort | undefined)` also fire in
  uncontrolled mode.
- Sorting never changes column widths: the arrow slot has a fixed width and the
  clear button is always rendered, hidden via `visibility` when inactive.

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

## Add a component
- Export it from `src/index.ts`; it is the package entry (`vite.config.ts` uses it).
- Co-locate styles in `src/`; `scripts/build.ts` copies `src/styles.css` to `dist/`.
  Never edit `dist/` by hand.
- Add a demo to `examples/App.tsx`.
- No new runtime deps; use SolidJS (`solid-js` is a peer dep).

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
  `.data-table-sort-indicator` and the `visibility`-hidden clear button
  (covered by `src/data-table.test.tsx`).
- Empty shows only when `!loading && (empty ?? rows.length === 0)`.
- Customizer panel dismisses on outside `pointerdown` and `Escape` with cleanup in
  `createEffect`; keep both listeners paired.

## Styling contract (`src/styles.css`)
- Theme via `--data-table-*` vars with fallbacks and `light-dark()`; `color-scheme`
  is inherited from the consumer, do not set it here.

## Verify
Tests (`src/**/*.test.tsx`) run in headless Chromium via Vitest browser mode, since
they measure real layout; install it once with `bunx playwright install chromium`.
Run the gate defined in `.github/workflows/ci.yml` using the script names in
`package.json`. Fix formatting with the write-mode lint script; keep `aria-sort`,
dialog, and checkbox label semantics when touching table markup.
