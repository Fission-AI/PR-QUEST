import { Suspense } from "react";
import { PrUrlIntakeCard } from "./pr-url-intake-card";

export default function Home() {
  return (
    <div className="home-shell">
      <section className="hero">
        <p className="hero__eyebrow">Interactive walkthroughs for real-world pull requests</p>
        <h1 className="hero__title">PR Quest</h1>
        <p className="hero__subtitle">
          Transform boring code reviews into epic adventures. AI-powered walkthroughs that make understanding pull requests fun.
        </p>

      </section>

      <Suspense fallback={<div>Loading...</div>}>
        <PrUrlIntakeCard id="start-your-quest" />
      </Suspense>
    </div>
  );
}
