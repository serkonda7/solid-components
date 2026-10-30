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

If your app imports `@tabler/icons-solidjs` itself, add the bundled Vite plugin
before `solid()`. Without it, dev mode loads all ~6000 icon modules:

```ts
import { tablerIcons } from '@serkonda7/solid-components/vite'

export default defineConfig({ plugins: [tablerIcons(), solid()] })
```

These components are available:
- `DataTable` - generic table with optional sorting, actions, loading and empty states, column customizer, resizable columns, sticky header and actions, and server-side pagination.
- `FilterTable` - `DataTable` with filtering: quick search, a grouped filter form, and removable filter pills.
- `Combobox` - searchable, accessible dropdown with keyboard navigation, option icons and previews, a detail column, and an optional "Add …" entry.
- `ColorInput` - hex color input with a native color picker swatch.
- `Modal` - controlled modal dialog with focus trapping and restore, a close button, Escape and backdrop-click closing.
- `SearchBar` - search input with clear button and a global Ctrl/Cmd+K focus shortcut.

For the full API, examples, and agent notes, see [docs.md](docs.md).


## 📜 License
This repo is licensed under the [MIT License](LICENSE.txt).


[ci-badge]: https://github.com/serkonda7/solid-components/actions/workflows/ci.yml/badge.svg
[ci-status]: https://github.com/serkonda7/solid-components/actions/workflows/ci.yml
[npm-badge]: https://nodei.co/npm/@serkonda7/solid-components.png?style=shields&data=v&color=blue
[npm-date-dl-badge]: https://nodei.co/npm/@serkonda7/solid-components.png?style=shields&data=u,d&color=blue
[npm-link]: https://www.npmjs.com/package/@serkonda7/solid-components
