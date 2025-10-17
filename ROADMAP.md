## ROADMAP — PR QUEST (Hackathon MVP)

This roadmap turns the PRD into iterative, testable phases. Each phase ships a working vertical slice that can be demoed and verified independently.

### Guiding Principles
- **Ship in slices**: Every phase produces a working demo artifact.
- **Deterministic tests**: Use fixtures and mocks to make results reproducible.
- **Progressively enhance**: Start with heuristics, then add LLM grouping, then polish.
- **No scope creep**: Follow PRD "Out of Scope".

### Tooling & Conventions
- **Framework**: Next.js (App Router), Tailwind CSS
- **Diff rendering**: `react-diff-view`
- **LLM**: AI SDK (`ai`) with `@ai-sdk/openai` provider; structured outputs (Zod)
- **Validation**: `zod` schemas for all external boundaries
- **Testing**: Vitest + React Testing Library; Playwright for minimal e2e
- **State**: In-memory/session only; simple TTL cache for PR URL → result
- **Feature flags**: `process.env.NEXT_PUBLIC_*` where client-visible; server-only otherwise

---

## Phase 0 — Bootstrap & Infrastructure
- **Goal**: Runnable Next.js app with baseline deps and CI checks.
- **Scope**:
  - [x] Init Next.js + Tailwind; add `react-diff-view`, `ai`, `@ai-sdk/openai`, `@ai-sdk/react`, `zod`, `cross-fetch`, `vitest`, `@testing-library/react`, `msw`, `playwright` (optional for smoke).
  - [x] Basic layout shell and placeholder pages.
  - [x] Scripts: dev, test, lint, typecheck, e2e.
- **Deliverables**:
  - [x] App compiles locally; CI runs tests and lint.
- **Tests**:
  - [x] Vitest: sanity render of home page.
  - [x] Playwright (optional): open `/` and see placeholder text.
- [x] **Acceptance**: `pnpm dev` runs; `pnpm test` passes; deploys to Vercel with placeholder page.

---

## Phase 1 — PR URL Input & Validation
- **Goal**: Accept a public GitHub PR URL and validate.
- **Scope**:
  - [x] Input form with URL parsing.
  - [x] Server validator to ensure public PR and `.diff` endpoint derivation.
- **Deliverables**:
  - [x] Derive `https://github.com/<org>/<repo>/pull/<id>.diff` from input.
- **Tests**:
  - [x] Unit: URL parser (good/bad cases).
- [x] **Acceptance**: Valid PR URL enables “Analyze” and previews derived `.diff` URL.

---

## Phase 2 — Diff Fetch API Route
- **Goal**: Fetch raw `.diff` via server API.
- **Scope**:
  - [x] `GET /api/diff?prUrl=…` → fetch `.diff` with unauthenticated GitHub request.
  - [x] Handle rate limits and large diffs (size cap + friendly error).
- **Deliverables**:
  - [x] Returns raw unified diff as text; standard error envelope.
- **Tests**:
  - [x] Unit: input validation; 4xx/5xx handling.
  - [x] Integration: fixture-backed response using MSW.
- [x] **Acceptance**: API returns diff for known fixture within <3s locally.

---

## Phase 3 — Diff Parsing & Index Builder
- **Goal**: Unified diff → normalized `diff_index` per PRD.
- **Scope**:
  - [x] Parse files, statuses, languages (by extension), and hunks.
  - [x] Generate stable `file_id` and `hunk_id` (`<path>#h<seq>`).
- **Deliverables**:
  - [x] `diff_index.json` matching PRD section 10.
- **Tests**:
  - [x] Snapshots on fixtures (single file, rename, binary skip, many hunks).
- [x] **Acceptance**: Stable IDs and correct hunk headers for fixtures.

---

## Phase 4 — Heuristic Grouping (LLM-free Baseline)
- **Goal**: 2–6 coherent steps using heuristics only.
- **Scope**:
  - [x] Cluster by path prefixes, file types, keywords in headers/paths.
  - [x] Output PRD “LLM Output Schema” without model call.
- **Deliverables**:
  - [x] `steps[]` with titles/descriptions/objectives and `diff_refs` → `file_id` + `hunk_ids`.
- **Tests**:
  - [x] Zod validation of schema; deterministic grouping for fixtures.
- [x] **Acceptance**: Typical PR fixture yields 2–6 sensible steps.

---

## Phase 5 — LLM Grouping via AI SDK
- **Goal**: Replace/augment heuristics with model-backed organization.
- **Scope**:
  - [x] Use `ai` with `@ai-sdk/openai`; prompt per PRD section 11.
  - [x] Structured outputs via `generateObject` + Zod schema; auto-retry on schema mismatch.
  - [x] Feature flag to toggle heuristic-only vs LLM.
- **Deliverables**:
  - [x] `POST /api/group` takes `{ diffIndex, metadata }` and returns PRD-compliant JSON.
- **Tests**:
  - [x] Unit: schema validation; retry logic via mocked provider.
  - [x] Integration: golden files for prompt → response mapping with deterministic mock.
- [x] **Acceptance**: With flag on, grouping quality improves; stays within 2–6 steps and references only provided IDs.

---

## Phase 6 — Step Renderer UI (Read-only)
- **Goal**: Render steps and linked diffs.
- **Scope**:
  - [x] Left rail: step list with progress.
  - [x] Main panel: title, description, objective; `react-diff-view` filtered by `hunk_ids`.
- **Deliverables**:
  - [x] Navigable read-only step view.
- **Tests**:
  - [x] Component tests with fixture data.
- [x] **Acceptance**: User sees steps and associated diffs; no notes/gamification yet.

---

## Phase 7 — Navigation & XP Gamification
- **Goal**: Progressive disclosure with XP.
- **Scope**:
  - [ ] Next/Previous; +10 XP per completed step; pixel progress bar; completion screen.
  - [ ] Simple in-memory state machine.
- **Deliverables**:
  - [ ] XP counter; “Quest Complete”.
- **Tests**:
  - [ ] State machine unit tests; progress transition tests.
- [ ] **Acceptance**: Completing all steps shows completion screen and XP total.

---

## Phase 8 — Notes per Step & Export
- **Goal**: Notes per step + export at end.
- **Scope**:
  - [ ] Textarea per step; export combined notes as markdown/plaintext.
  - [ ] No persistence beyond session.
- **Deliverables**:
  - [ ] Notes UI with export on completion screen.
- **Tests**:
  - [ ] Component tests; export includes step titles and notes.
- [ ] **Acceptance**: Notes captured and downloadable; preserved across navigation.

---

## Phase 9 — Caching & Idempotency
- **Goal**: Cache PR URL → grouped result; idempotent runs.
- **Scope**:
  - [ ] In-memory cache with TTL; key by normalized PR URL.
  - [ ] Return cached results when available.
- **Deliverables**:
  - [ ] Cache module with log counters.
- **Tests**:
  - [ ] Unit: hit/miss/eviction; concurrency safety.
- [ ] **Acceptance**: Second run for same PR returns instantly from cache.

---

## Phase 10 — Performance & Lazy-loading
- **Goal**: Keep UI responsive for larger diffs.
- **Scope**:
  - [ ] Lazy-load diffs per step; virtualize large hunks.
  - [ ] Streaming UI affordances (loading placeholders, blinking cursor animation per PRD).
- **Deliverables**:
  - [ ] Progressive rendering; smoother interaction on large fixture.
- **Tests**:
  - [ ] Manual perf checks; component tests remain deterministic.
- [ ] **Acceptance**: Large fixture remains smooth; initial render <2s locally.

---

## Phase 11 — Visual Aesthetic (Retro Skin)
- **Goal**: Apply 90s Apple-inspired theme.
- **Scope**:
  - [ ] Beige/cream palette, pixel borders, dotted grid, “Press Start 2P”.
  - [ ] Code styles: keywords green, strings orange, comments gray; filename headers.
- **Deliverables**:
  - [ ] Themed components and CSS tokens.
- **Tests**:
  - [ ] Visual sanity (manual or Storybook/Chromatic optional).
- [ ] **Acceptance**: UI reflects PRD aesthetic and remains readable.

---

## Phase 12 — Demo Readiness & Deploy
- **Goal**: Polished demo flow and deploy.
- **Scope**:
  - [ ] Env config for OpenAI provider; robust error handling.
  - [ ] Seed public PR fixtures via quick links.
  - [ ] README with demo instructions and limitations.
- **Deliverables**:
  - [ ] Vercel deployment URL; demo script; troubleshooting.
- **Tests**:
  - [ ] Smoke e2e on deployed preview with known PR.
- [ ] **Acceptance**: Judge can paste a public PR URL and complete the quest within ~10s typical.

---

### Dependencies (at a glance)
- 1 depends on 0
- 2 depends on 1
- 3 depends on 2
- 4 depends on 3
- 5 depends on 4
- 6 depends on 4 (read-only) and improves after 5
- 7 depends on 6
- 8 depends on 6
- 9 depends on 5
- 10 depends on 6
- 11 can run in parallel after 6
- 12 depends on 11 and core flows

### Test Fixtures (suggested)
- Small JS-only change
- Mixed frontend/backend change
- Rename + move
- Many small files
- Doc-only change
- Large PR with 50+ hunks (capped for demo)

### Environment Variables
- `OPENAI_API_KEY` (server)
- `FEATURE_USE_LLM=true|false` (server)
- `NEXT_PUBLIC_APP_NAME=PR QUEST` (client)

### Commands (suggested)
- `pnpm dev` — run app
- `pnpm test` — unit tests (Vitest)
- `pnpm e2e` — Playwright smoke
- `pnpm lint` — lint

---

## Cutlines (Nice-to-haves if time permits)
- Achievement variants; additional badges
- More sophisticated clustering heuristics (AST-aware where cheap)
- Offline demo mode with embedded fixtures
- Storybook for component review
