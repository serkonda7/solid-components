# @serkonda7/solid-components
[![CI][ci-badge]][ci-status]
[![npm version][npm-badge]][npm-link]
[![npm updated and downloads][npm-date-dl-badge]][npm-link]

Reusable components for [SolidJS](https://www.solidjs.com/).


## 📦 Installation
```sh
bun install @serkonda7/solid-components solid-js
```


## 🚀 Usage
```tsx
import { DataTable } from '@serkonda7/solid-components'
import '@serkonda7/solid-components/styles.css'

<DataTable
  rows={items}
  getRowId={(item) => item.id}
  columns={[{ key: 'name', label: 'Name' }]}
/>
```

These components are available:
- `DataTable` - generic table with optional sorting, row selection, actions, loading, empty states, and column customizer.

For the full API, examples, and agent notes, see [docs.md](docs.md).


## 📜 License
This repo is licensed under the [MIT License](LICENSE.txt).


[ci-badge]: https://github.com/serkonda7/solid-components/actions/workflows/ci.yml/badge.svg
[ci-status]: https://github.com/serkonda7/solid-components/actions/workflows/ci.yml
[npm-badge]: https://nodei.co/npm/@serkonda7/solid-components.png?style=shields&data=v&color=blue
[npm-date-dl-badge]: https://nodei.co/npm/@serkonda7/solid-components.png?style=shields&data=u,d&color=blue
[npm-link]: https://www.npmjs.com/package/@serkonda7/solid-components
