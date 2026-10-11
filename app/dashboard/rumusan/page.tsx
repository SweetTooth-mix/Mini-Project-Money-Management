import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ledgerData, type Search } from "@/lib/queries";
import { money } from "@/lib/money";
import { Field, PageHeading, Panel } from "@/components/ui";
import { PrintButton } from "@/components/form-controls";

export default async function Report({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requireUser();
  const [data, org] = await Promise.all([
    ledgerData(await searchParams),
    db.organization.findUniqueOrThrow({ where: { id: "main" } }),
  ]);
  const categories = new Map<string, { income: bigint; expense: bigint }>();
  for (const e of data.entries) {
    if (!["INCOME", "EXPENSE"].includes(e.type)) continue;
    const group = categories.get(e.category) ?? { income: 0n, expense: 0n };
    if (e.type === "INCOME") group.income += e.amountSen;
    else group.expense -= e.amountSen;
    categories.set(e.category, group);
  }
  const query = new URLSearchParams({
    month: data.month,
    account: data.accountId,
    fund: data.fundId,
  });
  return (
    <>
      <div className="no-print">
        <PageHeading
          title="Rumusan kewangan"
          description="Laporan yang mudah disemak, dibentang dan dicetak."
        >
          <a href={`/api/export?${query}`} className="button button-secondary">
            Eksport ledger CSV
          </a>
          <PrintButton />
        </PageHeading>
        <Panel title="Pilihan laporan">
          <form className="filter-bar">
            <Field label="Bulan">
              <input name="month" type="month" defaultValue={data.month} />
            </Field>
            <Field label="Akaun">
              <select name="account" defaultValue={data.accountId}>
                <option value="">Semua akaun</option>
                {data.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Dana">
              <select name="fund" defaultValue={data.fundId}>
                <option value="">Semua dana</option>
                {data.funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Field>
            <button className="button button-primary">Jana rumusan</button>
          </form>
        </Panel>
      </div>
      <article className="print-sheet report-sheet">
        <header className="report-letterhead">
          <span className="eyebrow">LAPORAN KEWANGAN BULANAN</span>
          <h2>{org.name}</h2>
          <p>{org.address}</p>
          <h3>Rumusan {data.label}</h3>
          <p>
            {data.accounts.find((a) => a.id === data.accountId)?.name ??
              "Semua akaun"}{" "}
            ·{" "}
            {data.funds.find((f) => f.id === data.fundId)?.name ?? "Semua dana"}
          </p>
        </header>
        <div className="report-opening">
          <span>Baki awal bulan</span>
          <strong>{money(data.opening)}</strong>
        </div>
        <table className="report-table">
          <thead>
            <tr>
              <th>Kategori</th>
              <th className="align-right">Penerimaan (RM)</th>
              <th className="align-right">Perbelanjaan (RM)</th>
            </tr>
          </thead>
          <tbody>
            {[...categories].map(([name, amounts]) => (
              <tr key={name}>
                <td>{name}</td>
                <td className="align-right amount">
                  {money(amounts.income, false)}
                </td>
                <td className="align-right amount">
                  {money(amounts.expense, false)}
                </td>
              </tr>
            ))}
            {!categories.size && (
              <tr>
                <td colSpan={3}>
                  Tiada penerimaan atau perbelanjaan dalam tempoh ini.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <th>Jumlah</th>
              <td className="align-right amount">
                {money(data.income, false)}
              </td>
              <td className="align-right amount">
                {money(data.expense, false)}
              </td>
            </tr>
          </tfoot>
        </table>
        <div className="report-totals">
          <div>
            <span>Lebihan / defisit operasi</span>
            <strong>{money(data.income - data.expense)}</strong>
          </div>
          <div>
            <span>Pelarasan, pembukaan & pindahan bersih</span>
            <strong>{money(data.adjustment)}</strong>
          </div>
          <div className="report-closing">
            <span>Baki akhir bulan</span>
            <strong>{money(data.closing)}</strong>
          </div>
        </div>
        <p className="report-explanation">
          Baki akhir = baki awal + penerimaan − perbelanjaan + pelarasan.
          Pindahan dalaman tidak dikira sebagai pendapatan. Pembatalan bayaran
          dipaparkan sebagai pelarasan pada tarikh pembalikan.
        </p>
        {data.entries.some((e) => !["INCOME", "EXPENSE"].includes(e.type)) && (
          <>
            <h3 className="report-adjustment-heading">
              Butiran pelarasan & pindahan
            </h3>
            <table>
              <thead>
                <tr>
                  <th>Rujukan</th>
                  <th>Butiran</th>
                  <th className="align-right">Amaun (RM)</th>
                </tr>
              </thead>
              <tbody>
                {data.entries
                  .filter((e) => !["INCOME", "EXPENSE"].includes(e.type))
                  .map((e) => (
                    <tr key={e.id}>
                      <td>{e.reference}</td>
                      <td>{e.description}</td>
                      <td className="align-right amount">
                        {money(e.amountSen, false)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </>
        )}
        <div className="signatures">
          {["Disediakan oleh", "Diperiksa oleh", "Diluluskan oleh"].map(
            (label, i) => (
              <div key={label}>
                <span>{label}</span>
                <div className="signature-line" />
                <strong>
                  {[org.preparedBy, org.checkedBy, org.approvedBy][i] ||
                    "________________"}
                </strong>
                <small>Tarikh: _________________</small>
              </div>
            ),
          )}
        </div>
        <footer className="document-print-footer">
          <span>Kira Rapi · Rumusan kewangan</span>
          <span>{data.label}</span>
        </footer>
      </article>
    </>
  );
}
