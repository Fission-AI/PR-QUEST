# PR QUEST

Phase 0 bootstraps the Next.js foundation for the interactive PR review adventure. Everything runs on `pnpm`, Tailwind, Vitest, Playwright, and the AI SDK stack detailed in the roadmap.

## Quickstart

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 to see the placeholder experience. The landing page intentionally highlights the next milestones so we can demo progress slice by slice.

## Scripts

- `pnpm dev` – start Next.js (Turbopack) locally.
- `pnpm build` – build the production bundle.
- `pnpm start` – serve the production build.
- `pnpm lint` – run `next lint` with the flat config.
- `pnpm typecheck` – ensure the TypeScript project is sound.
- `pnpm test` / `pnpm test:watch` – execute Vitest + Testing Library.
- `pnpm e2e` – run Playwright smoke tests (install browsers first with `pnpm exec playwright install`).

## Testing Utilities

- Vitest is pre-wired with Testing Library, Jest-DOM assertions, and an MSW server stubbed in `src/test`.
- Playwright is configured in `playwright.config.ts` to boot `pnpm dev` automatically for e2e smoke coverage.

## Next Steps

Phase 1 follows: accept a GitHub PR URL, validate it, and derive the `.diff` endpoint. Refer to [`ROADMAP.md`](ROADMAP.md) for the complete plan.
