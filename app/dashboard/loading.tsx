import { getI18n } from "@/lib/i18n-server";
export default async function Loading() {
  const { t } = await getI18n();

  return (
    <div className="loading-page" role="status" aria-busy="true">
      <div className="loading-state">
        <span className="loading-dot" />
        {t("Sedang memuatkan rekod…")}
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
