export default function Loading() {
  return (
    <div className="home-shell" aria-busy="true" aria-live="polite">
      <div className="retro-card analyzing-card" role="status">
        <div className="analyzing-card__spinner" aria-hidden />
        <h2 className="pixel-heading analyzing-card__title">Preparing review plan…</h2>
        <p className="analyzing-card__desc">Analyzing changes and planning your walkthrough.</p>
      </div>
    </div>
  );
}


