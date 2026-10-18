# Agent instructions

## Tabler icons

- Import icons only as named imports from the package root:
  `import { IconX } from '@tabler/icons-solidjs'`. Don't use namespace imports
  (`import * as ...`) or deep paths.
- Any Vite or Vitest config that serves code using icons must include
  `tablerIcons()` from `src/vite.ts` before `solid()`. Without it, Vite resolves
  the package's source barrel (`solid` export condition) and loads every icon
  module (~6000 requests). Consumers use the same plugin via
  `@serkonda7/solid-components/vite`. It errors instead of falling back to the
  barrel, so keep icon imports plain and named.
