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
  sortKey={sortKey}
  sortDirection={sortDirection}
  onSort={setSortKey}
  getCell={(item, column) => column.key === 'name' ? item.name : null}
/>
```

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
- Reactive props accept `T | Accessor<T>`; unwrap via `read()` (`src/data-table.tsx:54`).
  Do not call the prop directly.
- Cell precedence: `getCell` → `column.getValue` → `null`.
- Sort UI renders only when `column.sortable && onSort`; sorting itself stays in the
  consumer (see demo toggle).
- Selection column renders only when both `selected` and `onSelectionChange` are set.
  Select-all uses an `indeterminate` effect on a ref; keep it when refactoring.
- Visibility state drops unknown keys and omits `toggleable: false` columns from
  tracking (they stay visible implicitly); output keys follow `columns` order.
- Empty shows only when `!loading && (empty ?? rows.length === 0)`.
- Customizer panel dismisses on outside `pointerdown` and `Escape` with cleanup in
  `createEffect`; keep both listeners paired.

## Styling contract (`src/styles.css`)
- Theme via `--data-table-*` vars with fallbacks and `light-dark()`; `color-scheme`
  is inherited from the consumer, do not set it here.

## Verify
Run the gate defined in `.github/workflows/ci.yml` using the script names in
`package.json`. Fix formatting with the write-mode lint script; keep `aria-sort`,
dialog, and checkbox label semantics when touching table markup.
