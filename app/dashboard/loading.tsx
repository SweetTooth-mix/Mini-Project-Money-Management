export default function Loading() {
  return (
    <div className="loading-page" role="status" aria-busy="true">
      <div className="loading-state">
        <span className="loading-dot" />
        Sedang memuatkan rekod…
      </div>
      <div className="loading-skeletons" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="loading-skeleton-panel" aria-hidden="true" />
    </div>
  );
}
