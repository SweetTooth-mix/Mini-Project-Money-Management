"use client";
import { useI18n } from "@/components/language-provider";

import { CircleAlert } from "lucide-react";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useI18n();

  return (
    <div className="empty-state error-state" role="alert">
      <span>
        <CircleAlert size={26} />
      </span>
      <h2>{t("Rekod belum dapat dimuatkan.")}</h2>
      <p>
        {t(
          "Cuba muatkan semula. Jika masih berlaku, hubungi pentadbir organisasi.",
        )}
      </p>
      <button className="button button-primary" onClick={reset}>
        {t("Cuba semula")}
      </button>
    </div>
  );
}
