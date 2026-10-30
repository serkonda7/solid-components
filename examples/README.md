# Component showcase

This directory contains a small interactive showcase for the library. The current
library exposes `DataTable`, so the demo focuses on its complete API surface:

- sortable columns with built-in (uncontrolled) sorting that cycles asc, desc, unsorted;
- custom cell rendering, formatted values, and row actions;
- loading skeleton and empty content slots;
- server-side pagination with a sticky header and actions column;
- responsive styling and accessible table controls;
- `FilterTable` over a network device inventory (`devices.ts`): quick search,
  a grouped filter form with text, multi-select, and yes/no filters, and filter pills;
- `Combobox` with icons, a detail column, and an add entry;
- `Modal` with a form, focus restore, and Escape/backdrop closing;
- `SearchBar` with the Ctrl/Cmd+K shortcut.

## Run locally

From the repository root:

```sh
bun install
bun run examples
```

Then open `http://localhost:5175`. A sidebar switches between the examples; each one
has its own URL hash (for example `#filter-table`).
