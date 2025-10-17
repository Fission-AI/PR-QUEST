import { PrUrlIntakeCard } from "./pr-url-intake-card";

export default function Home() {
  return (
    <div className="home-shell">
      <section className="hero">
        <span className="hero__badge">EST. 2025</span>
        <h1 className="hero__title">PR Quest</h1>
        <p className="hero__subtitle">
          Transform boring code reviews into epic adventures. AI-powered walkthroughs that make understanding pull requests fun.
        </p>
        <div className="hero__status" role="status">
          <span aria-hidden className="hero__status-indicator" />
          <span>Level up your code review game</span>
        </div>
      </section>

      <PrUrlIntakeCard />
    </div>
  );
}
