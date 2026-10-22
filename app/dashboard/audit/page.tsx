import { uiLocale } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";
import Link from "next/link";
import { ArrowDownToLine, Search as SearchIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { auditData } from "@/lib/audit";
import type { Search } from "@/lib/queries";
import { Empty, Field, PageHeading, Panel } from "@/components/ui";

export default async function Audit({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { t, language } = await getI18n();

  await requireUser();
  const search = await searchParams;
  const data = await auditData(search);
  const filters = data.filters;
  const query = new URLSearchParams(
    Object.entries({
      q: filters.query,
      user: filters.userId,
      action: filters.action,
      from: filters.from,
      to: filters.to,
    }).filter(([, value]) => value),
  ).toString();
  const pageLink = (page: number) =>
    "?" +
    new URLSearchParams({
      ...Object.fromEntries(new URLSearchParams(query)),
      page: String(page),
    });
  return (
    <>
      <PageHeading
        title={t("Jejak audit")}
        description={t(
          "Siapa, bila dan apa yang berubah. Rekod untuk ketelusan organisasi.",
        )}
      >
        <a
          className="button button-secondary"
          href={`/api/audit/export${query ? `?${query}` : ""}`}
        >
          <ArrowDownToLine size={16} />
          {t("Eksport log CSV")}
        </a>
      </PageHeading>
      <Panel
        title={t("Log aktiviti")}
        description={t(
          "Tindakan kewangan dan perubahan akses direkodkan bersama transaksi berkaitan.",
        )}
      >
        <form className="filter-bar">
          <div className="search-input">
            <SearchIcon size={17} aria-hidden="true" />
            <input
              type="search"
              aria-label={t("Cari butiran, pengguna atau tindakan…")}
              name="q"
              defaultValue={filters.query}
              maxLength={200}
              placeholder={t("Cari butiran, pengguna atau tindakan…")}
            />
          </div>
          <Field label={t("Pengguna")}>
            <select name="user" defaultValue={filters.userId}>
              <option value="">{t("Semua pengguna")}</option>
              {data.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Tindakan")}>
            <select name="action" defaultValue={filters.action}>
              <option value="">{t("Semua tindakan")}</option>
              {data.actions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Dari tarikh")}>
            <input type="date" name="from" defaultValue={filters.from} />
          </Field>
          <Field label={t("Hingga tarikh")}>
            <input type="date" name="to" defaultValue={filters.to} />
          </Field>
          <button className="button button-secondary">{t("Tapis log")}</button>
        </form>
        <p className="form-hint">
          {t("Tarikh mengikut waktu Malaysia (GMT+8).")}
        </p>
        {data.logs.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("Masa (Malaysia)")}</th>
                  <th>{t("Pengguna")}</th>
                  <th>{t("Tindakan")}</th>
                  <th>{t("Butiran")}</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map((log) => (
                  <tr key={log.id}>
                    <td className="nowrap muted">
                      {new Intl.DateTimeFormat(uiLocale(language), {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Kuala_Lumpur",
                      }).format(log.createdAt)}
                    </td>
                    <td>
                      <strong>{log.user.name}</strong>
                    </td>
                    <td>
                      <span className="audit-action">{log.action}</span>
                    </td>
                    <td>{log.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : query ? (
          <Empty
            description={t(
              "Tiada log sepadan. Longgarkan penapis atau tukar julat tarikh.",
            )}
          />
        ) : (
          <Empty description={t("Aktiviti organisasi akan direkod di sini.")} />
        )}
        <div className="table-footer">
          <span>
            {t("{count} rekod · Halaman {page}", {
              count: data.count,
              page: data.page,
            })}
          </span>
          <div className="pagination">
            {data.page > 1 && (
              <Link href={pageLink(data.page - 1)}>{t("← Sebelum")}</Link>
            )}
            {data.page < data.pages && (
              <Link href={pageLink(data.page + 1)}>{t("Seterusnya →")}</Link>
            )}
          </div>
        </div>
      </Panel>
    </>
  );
}
