# @serkonda7/solid-components
[![CI][ci-badge]][ci-status]
[![npm version][npm-badge]][npm-link]
[![npm updated][npm-date-badge]][npm-link]

Reusable components for [SolidJS](https://www.solidjs.com/).


## 📦 Installation
```sh
bun install @serkonda7/solid-components solid-js
```


## 🚀 Usage
```tsx
import { /* Component */ } from 'solid-components'
import '@serkonda7/solid-components/styles.css'
```

These components are available:
- `DataTable` - generic table with optional sorting, row selection, actions, loading, and empty states.


## Components
### DataTable
The table does not fetch data or perform navigation.
Consumers provide the rows, cell rendering, and callbacks:

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


## 📜 License
This repo is licensed under the [MIT License](LICENSE.txt).


[ci-badge]: https://github.com/serkonda7/solid-components/actions/workflows/ci.yml/badge.svg
[ci-status]: https://github.com/serkonda7/solid-components/actions/workflows/ci.yml
[npm-badge]: https://nodei.co/npm/@serkonda7/solid-components.png?style=shields&data=v&color=blue
[npm-date-badge]: https://nodei.co/npm/@serkonda7/solid-components.png?style=shields&data=u&color=blue
[npm-link]: https://www.npmjs.com/package/@serkonda7/solid-components
