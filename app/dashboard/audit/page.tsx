import { uiLocale } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { param, type Search } from "@/lib/queries";
import { Empty, PageHeading, Panel } from "@/components/ui";

export default async function Audit({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { t, language } = await getI18n();

  await requireUser();
  const search = await searchParams,
    page = Math.max(1, Math.min(100000, parseInt(param(search, "page")) || 1));
  const [logs, count] = await Promise.all([
    db.auditLog.findMany({
      include: { user: { select: { name: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * 30,
      take: 30,
    }),
    db.auditLog.count(),
  ]);
  return (
    <>
      <PageHeading
        title={t("Jejak audit")}
        description={t(
          "Siapa, bila dan apa yang berubah. Rekod untuk ketelusan organisasi.",
        )}
      />
      <Panel
        title={t("Log aktiviti")}
        description={t(
          "Tindakan kewangan dan perubahan akses direkodkan bersama transaksi berkaitan.",
        )}
      >
        {logs.length ? (
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
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="nowrap muted">
                      {new Intl.DateTimeFormat(uiLocale(language), {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Kuala_Lumpur",
                      }).format(l.createdAt)}
                    </td>
                    <td>
                      <strong>{l.user.name}</strong>
                    </td>
                    <td>
                      <span className="audit-action">{l.action}</span>
                    </td>
                    <td>{l.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty description={t("Aktiviti organisasi akan direkod di sini.")} />
        )}
        <div className="table-footer">
          <span>{t("{count} rekod · Halaman {page}", { count, page })}</span>
          <div className="pagination">
            {page > 1 && (
              <Link href={`?page=${page - 1}`}>{t("← Sebelum")}</Link>
            )}
            {page * 30 < count && (
              <Link href={`?page=${page + 1}`}>{t("Seterusnya →")}</Link>
            )}
          </div>
        </div>
      </Panel>
    </>
  );
}
