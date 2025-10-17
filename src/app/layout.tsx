import type { Metadata } from "next";
import Link from "next/link";
import { Press_Start_2P } from "next/font/google";
import "./globals.css";

const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
});

export const metadata: Metadata = {
  title: "PR QUEST",
  description:
    "Bootstrapped foundation for an interactive pull request review experience.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${pressStart.variable} retro-body`}>
        <div aria-hidden className="pixel-noise" />
        <div aria-hidden className="pixel-floaters">
          <span className="pixel-sparkle pixel-sparkle--one" />
          <span className="pixel-sparkle pixel-sparkle--two" />
          <span className="pixel-sparkle pixel-sparkle--three" />
        </div>
        <div className="relative z-10 flex min-h-screen flex-col gap-6 px-4 py-6 md:px-8">
          <header className="mx-auto w-full max-w-5xl">
            <div className="pixel-panel flex flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between">
              <Link className="pixel-heading text-base" href="/">
                PR QUEST
              </Link>
              <nav className="flex flex-wrap gap-3">
                <Link
                  className="pixel-button"
                  href="https://github.com/fission-cmd/PR-QUEST/blob/main/ROADMAP.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  Roadmap
                </Link>
                <Link
                  className="pixel-button"
                  href="https://github.com/fission-cmd/PR-QUEST/blob/main/PRD.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  PRD
                </Link>
              </nav>
            </div>
          </header>
          <main className="flex-1">
            <div className="mx-auto w-full max-w-5xl">{children}</div>
          </main>
          <footer className="mx-auto w-full max-w-5xl">
            <div className="pixel-panel flex flex-col gap-3 px-6 py-4 text-xs md:flex-row md:items-center md:justify-between">
              <span className="pixel-heading text-[10px] text-muted-brown">
                Phase 0 · Bootstrap &amp; Infrastructure
              </span>
              <span className="font-mono text-[11px] text-ink">
                pnpm dev · pnpm test · pnpm lint
              </span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
