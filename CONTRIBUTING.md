# Contributing

1. Install dependencies with `bun install`.
2. Add or update tests alongside source changes.
3. Run `bun run test` and `bun run lint:ci` before opening a pull request.

Keep public exports in `src/index.ts` and avoid adding runtime dependencies when
the functionality can be implemented with SolidJS itself.
