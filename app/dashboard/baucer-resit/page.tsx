import { uiDate } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";
import Link from "next/link";
import { DocumentStatus, DocumentType } from "@prisma/client";
import { FilePlus2, Search as SearchIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { param, type Search } from "@/lib/queries";
import { money } from "@/lib/money";
import { DocumentForm } from "@/components/document-form";
import { Disclosure } from "@/components/disclosure";
import { Empty, Flash, PageHeading, Panel, Status } from "@/components/ui";

export default async function Documents({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { t, language } = await getI18n();

  await requireUser();
  const search = await searchParams,
    status = param(search, "status"),
    type = param(search, "type"),
    query = param(search, "q").slice(0, 200);
  const page = Math.max(
    1,
    Math.min(100000, Number.parseInt(param(search, "page")) || 1),
  );
  const where = {
    ...(Object.values(DocumentStatus).includes(status as DocumentStatus)
      ? { status: status as DocumentStatus }
      : {}),
    ...(Object.values(DocumentType).includes(type as DocumentType)
      ? { type: type as DocumentType }
      : {}),
    ...(query
      ? {
          OR: [
            { party: { contains: query, mode: "insensitive" as const } },
            { number: { contains: query, mode: "insensitive" as const } },
            { description: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [documents, count, accounts, funds] = await Promise.all([
    db.document.findMany({
      where,
      include: { fund: true, createdBy: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      skip: (page - 1) * 20,
    }),
    db.document.count({ where }),
    db.account.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    db.fund.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
  ]);
  const pageLink = (p: number) =>
    "?" + new URLSearchParams({ status, type, q: query, page: String(p) });
  return (
    <>
      <PageHeading
        title={t("Resit & baucer")}
        description={t(
          "Dari draf hingga bayaran. Setiap dokumen mempunyai jejak yang jelas.",
        )}
      >
        <a href="#baharu" className="button button-primary">
          <FilePlus2 size={17} />
          {t("Dokumen baharu")}
        </a>
      </PageHeading>
      <Flash search={search} />
      <Panel
        title={t("Semua dokumen")}
        action={
          <span className="subtle-tag">{t("{count} rekod", { count })}</span>
        }
      >
        <form className="document-filters">
          <div className="search-input">
            <SearchIcon size={17} />
            <input
              aria-label={t("Cari dokumen")}
              name="q"
              defaultValue={query}
              placeholder={t("Cari nombor, nama atau butiran…")}
            />
          </div>
          <select
            name="type"
            aria-label={t("Jenis dokumen")}
            defaultValue={type}
          >
            <option value="">{t("Semua jenis")}</option>
            <option value="RESIT">{t("Resit")}</option>
            <option value="BAUCER">{t("Baucer")}</option>
          </select>
          <select
            name="status"
            aria-label={t("Status dokumen")}
            defaultValue={status}
          >
            <option value="">{t("Semua status")}</option>
            {Object.values(DocumentStatus).map((s) => (
              <option key={s} value={s}>
                {
                  {
                    DRAFT: t("Draf"),
                    PENDING: t("Menunggu kelulusan"),
                    APPROVED: t("Diluluskan"),
                    REJECTED: t("Ditolak"),
                    PAID: t("Selesai"),
                    VOID: t("Dibatalkan"),
                  }[s]
                }
              </option>
            ))}
          </select>
          <button className="button button-secondary">{t("Cari")}</button>
        </form>
        {documents.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("Dokumen / Penerima")}</th>
                  <th>{t("Tarikh")}</th>
                  <th>{t("Dana")}</th>
                  <th>{t("Status")}</th>
                  <th className="align-right">{t("Amaun")}</th>
                  <th>
                    <span className="sr-only">{t("Tindakan")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link
                        className="document-number"
                        href={`/dashboard/baucer-resit/${d.id}`}
                      >
                        <span
                          className={`type-tag ${d.type === "RESIT" ? "receipt" : "voucher"}`}
                        >
                          {d.type === "RESIT" ? "R" : "B"}
                        </span>
                        {d.number}
                      </Link>
                      <small className="table-sub">{d.party}</small>
                    </td>
                    <td className="nowrap muted">{uiDate(d.date, language)}</td>
                    <td>
                      <span className="fund-label">
                        <i style={{ background: d.fund.color }} />
                        {d.fund.name}
                      </span>
                    </td>
                    <td>
                      <Status value={d.status} />
                    </td>
                    <td className="align-right amount">{money(d.amountSen)}</td>
                    <td>
                      <Link
                        href={`/dashboard/baucer-resit/${d.id}`}
                        className="text-link"
                      >
                        {t("Lihat →")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            description={t(
              "Tiada dokumen sepadan. Cuba penapis lain atau cipta dokumen baharu.",
            )}
          />
        )}
        <div className="table-footer">
          <span>{t("Halaman {page} · {count} dokumen", { page, count })}</span>
          <div className="pagination">
            {page > 1 && (
              <Link href={pageLink(page - 1)}>{t("← Sebelum")}</Link>
            )}
            {page * 20 < count && (
              <Link href={pageLink(page + 1)}>{t("Seterusnya →")}</Link>
            )}
          </div>
        </div>
      </Panel>
      <Disclosure
        id="baharu"
        title={t("Dokumen baharu")}
        description={t("Sediakan resit penerimaan atau baucer bayaran.")}
      >
        <DocumentForm accounts={accounts} funds={funds} />
      </Disclosure>
    </>
  );
}
