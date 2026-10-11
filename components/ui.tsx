import Link from "next/link";
import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type HTMLAttributes,
} from "react";
import { ArrowDownLeft, ArrowUpRight, FileText, Plus } from "lucide-react";
import { money, shortDate } from "@/lib/money";
import type { Search } from "@/lib/queries";

export function PageHeading({
  eyebrow = "KEWANGAN KOMUNITI",
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}
export function Flash({ search }: { search: Search }) {
  const error = typeof search.error === "string" ? search.error : "";
  const success = typeof search.success === "string" ? search.success : "";
  if (!error && !success) return null;
  return (
    <div
      className={`flash ${error ? "flash-error" : "flash-success"}`}
      role={error ? "alert" : "status"}
    >
      {(error || success).slice(0, 500)}
    </div>
  );
}
export function Metric({
  label,
  value,
  detail,
  icon,
  featured = false,
  tone = "green",
}: {
  label: string;
  value: string;
  detail: string;
  icon?: React.ReactNode;
  featured?: boolean;
  tone?: string;
}) {
  return (
    <section className={`metric ${featured ? "metric-featured" : ""}`}>
      <div className="metric-top">
        <span>{label}</span>
        <span className={`metric-icon ${tone}`}>{icon}</span>
      </div>
      <strong className="metric-value">{value}</strong>
      <div className="metric-detail">{detail}</div>
      {featured && <span className="metric-decoration" aria-hidden="true" />}
    </section>
  );
}
export function Empty({
  title = "Belum ada rekod",
  description = "Rekod baharu akan dipaparkan di sini.",
  href,
  label,
}: {
  title?: string;
  description?: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="empty-state">
      <span>
        <FileText size={26} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {href && (
        <Link href={href} className="button button-primary">
          <Plus size={16} />
          {label ?? "Tambah rekod"}
        </Link>
      )}
    </div>
  );
}
const statusNames: Record<string, string> = {
  DRAFT: "Draf",
  PENDING: "Menunggu kelulusan",
  APPROVED: "Diluluskan",
  REJECTED: "Ditolak",
  PAID: "Selesai",
  VOID: "Dibatalkan",
  ACTIVE: "Aktif",
  DISABLED: "Tidak aktif",
};
export function Status({ value }: { value: string }) {
  return (
    <span className={`status status-${value.toLowerCase()}`}>
      <i />
      {statusNames[value] ?? value}
    </span>
  );
}
export function Field({
  label,
  children,
  wide = false,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className={`field ${wide ? "field-wide" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {Children.map(children, (child, index) =>
        index === 0 && isValidElement<HTMLAttributes<HTMLElement>>(child)
          ? cloneElement(child, {
              id,
              "aria-describedby": hint ? `${id}-hint` : undefined,
            })
          : child,
      )}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function Panel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function EntryTable({
  entries,
  running,
}: {
  entries: {
    id: string;
    date: Date;
    reference: string;
    description: string;
    amountSen: bigint;
    type: string;
    fund: { name: string; color: string };
    account: { name: string };
    documentId: string | null;
  }[];
  running?: bigint[];
}) {
  if (!entries.length)
    return (
      <Empty description="Tiada transaksi untuk pilihan tempoh dan penapis ini." />
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Transaksi</th>
            <th>Tarikh</th>
            <th>Dana / Akaun</th>
            <th className="align-right">Amaun</th>
            {running && <th className="align-right">Baki</th>}
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={e.id}>
              <td>
                <div className="transaction-cell">
                  <span
                    className={`transaction-icon ${e.amountSen >= 0n ? "in" : "out"}`}
                  >
                    {e.amountSen >= 0n ? (
                      <ArrowDownLeft size={18} />
                    ) : (
                      <ArrowUpRight size={18} />
                    )}
                  </span>
                  <div>
                    {e.documentId ? (
                      <Link
                        href={`/dashboard/baucer-resit/${e.documentId}`}
                        className="table-primary"
                      >
                        {e.description}
                      </Link>
                    ) : (
                      <strong className="table-primary">{e.description}</strong>
                    )}
                    <small>
                      {e.reference}
                      {e.type === "REVERSAL"
                        ? " · Pembalikan"
                        : e.type.startsWith("TRANSFER")
                          ? " · Pindahan"
                          : ""}
                    </small>
                  </div>
                </div>
              </td>
              <td className="nowrap muted">{shortDate(e.date)}</td>
              <td>
                <span className="fund-label">
                  <i style={{ background: e.fund.color }} />
                  {e.fund.name}
                </span>
                <small className="table-sub">{e.account.name}</small>
              </td>
              <td
                className={`align-right amount ${e.amountSen >= 0n ? "text-green" : "text-dark"}`}
              >
                {e.amountSen > 0n ? "+" : ""}
                {money(e.amountSen)}
              </td>
              {running && (
                <td className="align-right amount">{money(running[i])}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
