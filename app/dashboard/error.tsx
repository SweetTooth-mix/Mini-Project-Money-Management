"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state">
      <h2>Rekod belum dapat dimuatkan.</h2>
      <p>Semak sambungan pangkalan data dan cuba semula.</p>
      <button className="button button-primary" onClick={reset}>
        Cuba semula
      </button>
    </div>
  );
}
