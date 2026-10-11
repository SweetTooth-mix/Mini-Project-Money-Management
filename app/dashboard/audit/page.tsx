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
        title="Jejak audit"
        description="Siapa, bila dan apa yang berubah. Rekod untuk ketelusan organisasi."
      />
      <Panel
        title="Log aktiviti"
        description="Tindakan kewangan dan perubahan akses direkodkan bersama transaksi berkaitan."
      >
        {logs.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Masa (Malaysia)</th>
                  <th>Pengguna</th>
                  <th>Tindakan</th>
                  <th>Butiran</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="nowrap muted">
                      {new Intl.DateTimeFormat("ms-MY", {
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
          <Empty description="Aktiviti organisasi akan direkod di sini." />
        )}
        <div className="table-footer">
          <span>
            {count} rekod · Halaman {page}
          </span>
          <div className="pagination">
            {page > 1 && <Link href={`?page=${page - 1}`}>← Sebelum</Link>}
            {page * 30 < count && (
              <Link href={`?page=${page + 1}`}>Seterusnya →</Link>
            )}
          </div>
        </div>
      </Panel>
    </>
  );
}
