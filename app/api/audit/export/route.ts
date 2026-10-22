import { currentUser } from "@/lib/auth";
import { auditExportRows } from "@/lib/audit";
import { csvCell } from "@/lib/ledger";

export const dynamic = "force-dynamic";

/**
 * Export the audit log as CSV using the same filters as the dashboard page.
 *
 * The audit log is append-only (enforced by a database trigger), so this route
 * only reads. Cells pass through csvCell to defuse spreadsheet formulas.
 */
export async function GET(request: Request) {
  if (!(await currentUser()))
    return Response.json({ error: "Log masuk diperlukan." }, { status: 401 });
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const rows = await auditExportRows(params);
  const when = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kuala_Lumpur",
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((parts, part) => {
      parts[part.type] = part.value;
      return parts;
    }, {});
  const stamp = `${when.year}${when.month}${when.day}-${when.hour}${when.minute}`;
  const header = [
    "Masa (Malaysia)",
    "Pengguna",
    "E-mel",
    "Tindakan",
    "Entiti",
    "Butiran",
  ];
  const body = rows.map((row) => [
    new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Kuala_Lumpur",
    })
      .format(row.createdAt)
      .replace(",", ""),
    row.user.name,
    row.user.email,
    row.action,
    row.entityId,
    row.detail,
  ]);
  const csv = [header, ...body]
    .map((line) => line.map(csvCell).join(","))
    .join("\r\n");
  return new Response("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="jejak-audit-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
