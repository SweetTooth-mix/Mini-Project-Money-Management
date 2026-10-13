"use client";

import { useState, useTransition } from "react";
import { Languages } from "lucide-react";
import { setLanguage } from "@/app/language-actions";
import { useI18n } from "./language-provider";

export function LanguageToggle() {
  const { language, t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const next = language === "ms" ? "en" : "ms";
  const label = t(
    next === "en" ? "Tukar ke English" : "Tukar ke Bahasa Melayu",
  );
  return (
    <>
      <button
        type="button"
        className="theme-toggle language-toggle"
        aria-label={label}
        title={label}
        aria-busy={pending}
        disabled={pending}
        onClick={() => {
          setFailed(false);
          startTransition(async () => {
            try {
              await setLanguage(next);
            } catch {
              setFailed(true);
            }
          });
        }}
      >
        <Languages size={18} aria-hidden="true" />
        <span>{language === "ms" ? "BM" : "EN"}</span>
      </button>
      {failed && (
        <span role="alert" className="language-error">
          {t("Bahasa tidak dapat ditukar. Cuba semula.")}
        </span>
      )}
    </>
  );
}
