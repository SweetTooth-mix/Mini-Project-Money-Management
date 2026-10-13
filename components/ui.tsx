import { getI18n } from "@/lib/i18n-server";
import Link from "next/link";
import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type HTMLAttributes,
} from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleAlert,
  CircleCheck,
  FileText,
  Plus,
} from "lucide-react";
import { money } from "@/lib/money";
import type { Search } from "@/lib/queries";
import { translateMessage, uiDate } from "@/lib/i18n";

export async function PageHeading({
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
  const { language } = await getI18n();

  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{translateMessage(eyebrow, language)}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}
export async function Flash({ search }: { search: Search }) {
  const { language } = await getI18n();

  const error = typeof search.error === "string" ? search.error : "";
  const success = typeof search.success === "string" ? search.success : "";
  if (!error && !success) return null;
  return (
    <div
      className={`flash ${error ? "flash-error" : "flash-success"}`}
      role={error ? "alert" : "status"}
    >
      {error ? (
        <CircleAlert size={18} aria-hidden="true" />
      ) : (
        <CircleCheck size={18} aria-hidden="true" />
      )}
      <span>
        {translateMessage((error || success).slice(0, 500), language)}
      </span>
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
    <section
      className={`metric metric-${tone} ${featured ? "metric-featured" : ""}`}
    >
      <div className="metric-top">
        <span>{label}</span>
        <span className={`metric-icon ${tone}`}>{icon}</span>
      </div>
      <strong className="metric-value">{value}</strong>
      <div className="metric-detail">{detail}</div>
    </section>
  );
}
export async function Empty({
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
  const { t, language } = await getI18n();

  return (
    <div className="empty-state">
      <span>
        <FileText size={26} />
      </span>
      <h3>{translateMessage(title, language)}</h3>
      <p>{translateMessage(description, language)}</p>
      {href && (
        <Link href={href} className="button button-primary">
          <Plus size={16} />
          {label ?? t("Tambah rekod")}
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
export async function Status({ value }: { value: string }) {
  const { language } = await getI18n();

  return (
    <span className={`status status-${value.toLowerCase()}`}>
      <i />
      {translateMessage(statusNames[value] ?? value, language)}
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
export async function EntryTable({
  entries,
  running,
  compact = false,
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
  compact?: boolean;
}) {
  const { t, language } = await getI18n();

  if (!entries.length)
    return (
      <Empty
        description={t("Tiada transaksi untuk pilihan tempoh dan penapis ini.")}
      />
    );
  if (compact)
    return (
      <ul className="recent-entries" aria-label={t("Transaksi terkini")}>
        {entries.map((entry) => (
          <li key={entry.id}>
            <span
              className={`transaction-icon ${entry.amountSen >= 0n ? "in" : "out"}`}
              aria-hidden="true"
            >
              {entry.amountSen >= 0n ? (
                <ArrowDownLeft size={18} />
              ) : (
                <ArrowUpRight size={18} />
              )}
            </span>
            <div className="recent-entry-copy">
              {entry.documentId ? (
                <Link
                  href={`/dashboard/baucer-resit/${entry.documentId}`}
                  className="table-primary"
                >
                  {entry.description}
                </Link>
              ) : (
                <strong className="table-primary">{entry.description}</strong>
              )}
              <small>
                {entry.reference}
                <span> · </span>
                {uiDate(entry.date, language)}
                {entry.type === "REVERSAL"
                  ? t(" · Pembalikan")
                  : entry.type.startsWith("TRANSFER")
                    ? t(" · Pindahan")
                    : ""}
              </small>
            </div>
            <strong
              className={`amount ${entry.amountSen >= 0n ? "text-green" : "text-dark"}`}
            >
              {entry.amountSen > 0n ? "+" : ""}
              {money(entry.amountSen)}
            </strong>
          </li>
        ))}
      </ul>
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{t("Transaksi")}</th>
            <th>{t("Tarikh")}</th>
            <th>{t("Dana / Akaun")}</th>
            <th className="align-right">{t("Amaun")}</th>
            {running && <th className="align-right">{t("Baki")}</th>}
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
                        ? t(" · Pembalikan")
                        : e.type.startsWith("TRANSFER")
                          ? t(" · Pindahan")
                          : ""}
                    </small>
                  </div>
                </div>
              </td>
              <td className="nowrap muted">{uiDate(e.date, language)}</td>
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
