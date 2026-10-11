import Link from "next/link";
import { ArrowDownToLine, ArrowLeftRight, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ledgerData, type Search } from "@/lib/queries";
import { money, today } from "@/lib/money";
import {
  EntryTable,
  Field,
  Flash,
  Metric,
  PageHeading,
  Panel,
} from "@/components/ui";
import { Submit } from "@/components/form-controls";
import { transferAction } from "@/app/actions";

export default async function Ledger({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await requireUser(),
    search = await searchParams;
  const data = await ledgerData(search);
  const query = new URLSearchParams({
    month: data.month,
    account: data.accountId,
    fund: data.fundId,
  }).toString();
  return (
    <>
      <PageHeading
        title="Buku tunai"
        description="Setiap pergerakan wang, direkod dengan jelas dan tersusun."
      >
        <a className="button button-secondary" href={`/api/export?${query}`}>
          <ArrowDownToLine size={16} />
          Eksport CSV
        </a>
        <Link
          href="/dashboard/baucer-resit#baharu"
          className="button button-primary"
        >
          <Plus size={16} />
          Rekod baharu
        </Link>
      </PageHeading>
      <Flash search={search} />
      <div className="metrics-grid">
        <Metric
          label="Baki awal"
          value={money(data.opening)}
          detail={`Sebelum ${data.label}`}
        />
        <Metric
          label="Penerimaan"
          value={money(data.income)}
          detail="Resit yang telah selesai"
        />
        <Metric
          label="Perbelanjaan"
          value={money(data.expense)}
          detail="Baucer yang telah dibayar"
        />
        <Metric
          featured
          label="Baki akhir"
          value={money(data.closing)}
          detail={`Pelarasan / pindahan: ${money(data.adjustment)}`}
        />
      </div>
      <Panel
        title="Ledger transaksi"
        description="Baki dikira mengikut turutan tarikh, termasuk pembalikan dan pindahan."
      >
        <form className="filter-bar">
          <Field label="Bulan">
            <input
              type="month"
              name="month"
              defaultValue={data.month}
              required
            />
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
          <button className="button button-secondary">Tapis rekod</button>
        </form>
        <EntryTable entries={data.entries} running={data.running} />
        <div className="table-footer">
          <span>
            {data.entries.length} transaksi · {data.label}
          </span>
          <strong>Baki akhir: {money(data.closing)}</strong>
        </div>
      </Panel>
      {user.role !== "USER" && (
        <details className="form-disclosure">
          <summary>
            <ArrowLeftRight size={18} />
            <span>
              Pindahan antara akaun
              <small>
                Pindahkan wang tanpa menambah pendapatan atau perbelanjaan.
              </small>
            </span>
            <Plus size={18} />
          </summary>
          <form action={transferAction} className="form-grid">
            <Field label="Dari akaun">
              <select name="fromId" required>
                {data.accounts
                  .filter((a) => a.active)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Ke akaun">
              <select name="toId" defaultValue={data.accounts[1]?.id} required>
                {data.accounts
                  .filter((a) => a.active)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Dana">
              <select name="fundId">
                {data.funds
                  .filter((f) => f.active)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Amaun (RM)">
              <input
                type="number"
                name="amount"
                min="0.01"
                step="0.01"
                required
              />
            </Field>
            <Field label="Tarikh pindahan">
              <input
                type="date"
                name="date"
                defaultValue={today()}
                max={today()}
                required
              />
            </Field>
            <Field label="Butiran">
              <input
                name="description"
                placeholder="Contoh: Tambah wang peti tunai"
                maxLength={200}
                required
              />
            </Field>
            <div className="form-footer field-wide">
              <Submit>Rekod pindahan</Submit>
            </div>
          </form>
        </details>
      )}
    </>
  );
}
