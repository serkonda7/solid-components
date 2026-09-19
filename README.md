# solid-components

Reusable components for [SolidJS](https://www.solidjs.com/).

## Installation

```sh
bun add solid-components solid-js
# or: npm install solid-components solid-js
```

## Usage

Import components from the package root:

```tsx
import { /* Component */ } from 'solid-components';
```

The package is currently a foundation for the component library. Components
will be added to `src/` and re-exported from `src/index.ts`.

## Development

Install [Bun](https://bun.sh/), then run:

```sh
bun install
bun run test       # type-check, build, and run tests
bun run lint:ci    # check formatting and lint rules
bun run build      # create the production package in dist/
```

## License

MIT
