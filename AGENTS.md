# Agent instructions

## Tabler icons

- Import icons only as named imports from the package root:
  `import { IconX } from '@tabler/icons-solidjs'`. Don't use namespace imports
  (`import * as ...`) or deep paths.
- Any Vite or Vitest config that serves code using icons in dev must include
  `tablerIcons()` from `scripts/vite-tabler-icons.ts` before `solid()`.
  Without it, Vite resolves the package's source barrel and loads every icon
  module (~6000 requests).
