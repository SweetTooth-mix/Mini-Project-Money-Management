import { currentUser } from "@/lib/auth";
import { ledgerData } from "@/lib/queries";
import { csvCell } from "@/lib/ledger";

export async function GET(request: Request) {
  if (!(await currentUser()))
    return Response.json({ error: "Log masuk diperlukan." }, { status: 401 });
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const data = await ledgerData(params);
  const decimal = (sen: bigint) =>
    `${sen < 0n ? "-" : ""}${(sen < 0n ? -sen : sen) / 100n}.${((sen < 0n ? -sen : sen) % 100n).toString().padStart(2, "0")}`;
  const rows = [
    [
      "Tarikh",
      "Rujukan",
      "Butiran",
      "Akaun",
      "Dana",
      "Jenis",
      "Amaun (RM)",
      "Baki (RM)",
    ]
      .map(csvCell)
      .join(","),
    [
      data.from.toISOString().slice(0, 10),
      "",
      "Baki awal",
      "",
      "",
      "OPENING_SUMMARY",
    ]
      .map(csvCell)
      .join(",") + `,0.00,${decimal(data.opening)}`,
    ...data.entries.map(
      (e, i) =>
        [
          e.date.toISOString().slice(0, 10),
          e.reference,
          e.description,
          e.account.name,
          e.fund.name,
          e.type,
        ]
          .map(csvCell)
          .join(",") + `,${decimal(e.amountSen)},${decimal(data.running[i])}`,
    ),
  ];
  return new Response("\uFEFF" + rows.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="buku-tunai-${data.month}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
