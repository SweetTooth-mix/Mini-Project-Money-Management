"use client";
import { useI18n } from "@/components/language-provider";

import { useState } from "react";
import { translateMessage } from "@/lib/i18n";

export function ExcelExport({
  document,
  year,
}: {
  document?: string;
  year?: number;
}) {
  const { t, language } = useI18n();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function generate(button: HTMLButtonElement, format: string) {
    const form = button.form;
    if (form && !form.reportValidity()) return;
    const query = new URLSearchParams();
    if (form)
      new FormData(form).forEach((value, key) => {
        if (typeof value === "string" && value) query.set(key, value);
      });
    query.set("format", format);
    if (document) {
      query.set("document", document);
      query.set("year", String(year));
      query.set("report", "document");
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/reports?${query}`);
      if (!response.ok)
        throw new Error(
          (await response.json()).error || t("Laporan gagal dijana."),
        );
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download =
        response.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] || `Kira-Rapi.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Laporan gagal dijana."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="excel-export-actions">
      <button
        type="button"
        className="button button-primary"
        disabled={busy}
        onClick={(e) => generate(e.currentTarget, document ? "xlsx" : "zip")}
      >
        {busy
          ? t("Sedang menjana…")
          : document
            ? t("Excel format asal")
            : t("Jana 4 Excel berpaut (.zip)")}
      </button>
      <button
        type="button"
        className="button button-secondary"
        disabled={busy}
        onClick={(e) => generate(e.currentTarget, "pdf")}
      >
        {t("PDF format asal")}
      </button>
      <span role="status" className="excel-status">
        {busy
          ? t(
              "Menyediakan fail daripada rekod semasa. PDF mungkin mengambil masa sehingga satu minit.",
            )
          : ""}
      </span>
      {error && (
        <p role="alert" className="excel-error">
          {translateMessage(error, language)}
        </p>
      )}
    </div>
  );
}
