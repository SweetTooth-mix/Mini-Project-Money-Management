"use client";
import { useFormStatus } from "react-dom";
import { LoaderCircle, Printer } from "lucide-react";

export function Submit({
  children,
  className = "button button-primary",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending && <LoaderCircle size={16} className="spin" />}
      {pending ? "Sedang menyimpan…" : children}
    </button>
  );
}
export function PrintButton({
  label = "Cetak / Simpan PDF",
}: {
  label?: string;
}) {
  return (
    <button
      className="button button-secondary no-print"
      onClick={() => window.print()}
    >
      <Printer size={16} />
      {label}
    </button>
  );
}
