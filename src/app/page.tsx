const questCommands = [
  {
    command: "pnpm dev",
    description: "Launch the retro Next.js hub with Turbopack.",
  },
  {
    command: "pnpm test",
    description: "Run Vitest + Testing Library sanity checks.",
  },
  {
    command: "pnpm lint",
    description: "Ensure pixel-perfect TypeScript + ESLint.",
  },
  {
    command: "pnpm e2e",
    description: "Playwright smoke jog through the quest board.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-10 pb-16">
      <section className="retro-card space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="pixel-badge">Phase 0 ready</span>
          <span className="pixel-stat text-ink">Retro Stack Online</span>
        </div>
        <h1 className="pixel-heading text-lg leading-relaxed md:text-xl">
          Build the PR review quest — one tested slice at a time.
        </h1>
        <p className="max-w-3xl text-sm text-muted-brown">
          Welcome to the staging area for our nostalgic pull request adventure.
          The beige command center ships with Tailwind v4, Vitest, Playwright,
          the AI SDK, and a pixel-perfect layout so future phases can unlock
          analysis, grouping, and XP without redoing scaffolding.
        </p>
        <div className="grid gap-6 md:grid-cols-[1.25fr_1fr]">
          <div className="retro-card space-y-5 bg-[#fdf1dc]">
            <h2 className="pixel-heading text-[11px] text-ink">Toolkit</h2>
            <ul className="space-y-2 text-sm text-ink">
              <li>Next.js 15 · App Router · pnpm</li>
              <li>Tailwind CSS 4 with retro theming</li>
              <li>AI SDK · Zod · react-diff-view</li>
              <li>Vitest + Testing Library + MSW</li>
              <li>Playwright smoke quests prewired</li>
            </ul>
          </div>
          <div className="retro-card space-y-5 bg-[#f7e7cf]">
            <h2 className="pixel-heading text-[11px] text-ink">
              Quest Console
            </h2>
            <div className="pixel-progress" role="meter" aria-valuenow={32} aria-valuemin={0} aria-valuemax={100}>
              <span className="pixel-progress__bar w-1/3" />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="pixel-heading text-[10px] text-ink">
                XP 032 / 100
              </span>
              <span className="pixel-heading text-[10px] text-muted-brown">
                Level 1 · Apprentice Reviewer
              </span>
            </div>
            <p className="text-xs text-muted-brown">
              Keep shipping slices to unlock feature flags, caching, and the XP
              badge forge.
            </p>
          </div>
        </div>
      </section>

      <section className="retro-card space-y-5 bg-[#fdf5e4]">
        <h2 className="pixel-heading text-[11px] text-ink">Command Deck</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {questCommands.map(({ command, description }) => (
            <li
              key={command}
              className="retro-card space-y-3 bg-[#fff9ea] shadow-none"
            >
              <code>{command}</code>
              <p className="text-xs text-muted-brown">{description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="retro-card space-y-5 bg-[#fdf1dc]">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="pixel-heading text-[11px] text-ink">
            Up next on the quest board
          </h2>
          <span className="pixel-heading text-[10px] text-muted-brown">
            Phase 1 queued
          </span>
        </div>
        <ul className="grid gap-4 md:grid-cols-3">
          <li className="retro-card space-y-3 bg-[#fffaf0]">
            <h3 className="pixel-heading text-[11px] text-ink">
              Phase 1 · PR URL Intake
            </h3>
            <p className="text-xs text-muted-brown">
              Capture GitHub PR links, normalize them, and compute the matching
              <span className="whitespace-nowrap"> .diff</span> endpoint.
            </p>
          </li>
          <li className="retro-card space-y-3 bg-[#fffaf0]">
            <h3 className="pixel-heading text-[11px] text-ink">
              Phase 2 · Diff Fetch API
            </h3>
            <p className="text-xs text-muted-brown">
              Server route to pull diffs with `cross-fetch`, plus MSW fixtures
              for reliable quest replays.
            </p>
          </li>
          <li className="retro-card space-y-3 bg-[#fffaf0]">
            <h3 className="pixel-heading text-[11px] text-ink">
              Phase 3 · Diff Index Builder
            </h3>
            <p className="text-xs text-muted-brown">
              Transform unified diffs into stable file &amp; hunk IDs that fuel
              grouping and gameplay.
            </p>
          </li>
        </ul>
      </section>
    </div>
  );
}
