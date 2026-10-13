"use client";
import { useI18n } from "@/components/language-provider";

import { useFormStatus } from "react-dom";
import { LoaderCircle, Printer } from "lucide-react";
import { translateMessage } from "@/lib/i18n";

export function Submit({
  children,
  className = "button button-primary",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { t } = useI18n();

  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending && <LoaderCircle size={16} className="spin" />}
      {pending ? t("Sedang menyimpan…") : children}
    </button>
  );
}
export function PrintButton({
  label = "Cetak / Simpan PDF",
}: {
  label?: string;
}) {
  const { language } = useI18n();

  return (
    <button
      className="button button-secondary no-print"
      onClick={() => window.print()}
    >
      <Printer size={16} />
      {translateMessage(label, language)}
    </button>
  );
}
