import { uiMonth } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";
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
  const { t, language } = await getI18n();

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
        title={t("Buku tunai")}
        description={t(
          "Setiap pergerakan wang, direkod dengan jelas dan tersusun.",
        )}
      >
        <a className="button button-secondary" href={`/api/export?${query}`}>
          <ArrowDownToLine size={16} />
          {t("Eksport CSV")}
        </a>
        <Link
          href="/dashboard/baucer-resit#baharu"
          className="button button-primary"
        >
          <Plus size={16} />
          {t("Rekod baharu")}
        </Link>
      </PageHeading>
      <Flash search={search} />
      <div className="metrics-grid">
        <Metric
          label={t("Baki awal")}
          value={money(data.opening)}
          detail={t("Sebelum {month}", {
            month: uiMonth(data.month, language),
          })}
        />
        <Metric
          label={t("Penerimaan")}
          value={money(data.income)}
          detail={t("Resit yang telah selesai")}
        />
        <Metric
          label={t("Perbelanjaan")}
          value={money(data.expense)}
          detail={t("Baucer yang telah dibayar")}
        />
        <Metric
          featured
          label={t("Baki akhir")}
          value={money(data.closing)}
          detail={t("Pelarasan / pindahan: {amount}", {
            amount: money(data.adjustment),
          })}
        />
      </div>
      <Panel
        title={t("Ledger transaksi")}
        description={t(
          "Baki dikira mengikut turutan tarikh, termasuk pembalikan dan pindahan.",
        )}
      >
        <form className="filter-bar">
          <Field label={t("Bulan")}>
            <input
              type="month"
              name="month"
              defaultValue={data.month}
              required
            />
          </Field>
          <Field label={t("Akaun")}>
            <select name="account" defaultValue={data.accountId}>
              <option value="">{t("Semua akaun")}</option>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Dana")}>
            <select name="fund" defaultValue={data.fundId}>
              <option value="">{t("Semua dana")}</option>
              {data.funds.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <button className="button button-secondary">
            {t("Tapis rekod")}
          </button>
        </form>
        <EntryTable entries={data.entries} running={data.running} />
        <div className="table-footer">
          <span>
            {t("{count} transaksi · {month}", {
              count: data.entries.length,
              month: uiMonth(data.month, language),
            })}
          </span>
          <strong>
            {t("Baki akhir:")} {money(data.closing)}
          </strong>
        </div>
      </Panel>
      {user.role !== "USER" && (
        <details className="form-disclosure">
          <summary>
            <ArrowLeftRight size={18} />
            <span>
              {t("Pindahan antara akaun")}
              <small>
                {t(
                  "Pindahkan wang tanpa menambah pendapatan atau perbelanjaan.",
                )}
              </small>
            </span>
            <Plus size={18} />
          </summary>
          <form action={transferAction} className="form-grid">
            <Field label={t("Dari akaun")}>
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
            <Field label={t("Ke akaun")}>
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
            <Field label={t("Dana")}>
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
            <Field label={t("Amaun (RM)")}>
              <input
                type="number"
                name="amount"
                min="0.01"
                step="0.01"
                required
              />
            </Field>
            <Field label={t("Tarikh pindahan")}>
              <input
                type="date"
                name="date"
                defaultValue={today()}
                max={today()}
                required
              />
            </Field>
            <Field label={t("Butiran")}>
              <input
                name="description"
                placeholder={t("Contoh: Tambah wang peti tunai")}
                maxLength={200}
                required
              />
            </Field>
            <div className="form-footer field-wide">
              <Submit>{t("Rekod pindahan")}</Submit>
            </div>
          </form>
        </details>
      )}
    </>
  );
}
