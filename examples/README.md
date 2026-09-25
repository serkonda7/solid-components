# Component showcase

This directory contains a small interactive showcase for the library. The current
library exposes `DataTable`, so the demo focuses on its complete API surface:

- sortable columns with built-in (uncontrolled) sorting that cycles asc, desc, unsorted;
- controlled row selection, including select-all and indeterminate state;
- custom cell rendering, formatted values, and row actions;
- loading and empty content slots;
- responsive styling and accessible table controls.

## Run locally

From the repository root:

```sh
bun install
bun run examples
```

Then open `http://localhost:5175`.
