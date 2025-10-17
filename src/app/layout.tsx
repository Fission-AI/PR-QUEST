import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";
import "./globals.css";
import "react-diff-view/style/index.css";

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
        <div className="relative z-10 flex min-h-screen flex-col px-4 py-4 md:px-8">
          <main className="flex-1">
            <div className="mx-auto w-full">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
