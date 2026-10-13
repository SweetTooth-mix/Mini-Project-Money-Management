import { uiMonth } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, UserPlus, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { monthRange, money } from "@/lib/money";
import { param, type Search } from "@/lib/queries";
import { createMemberAction, generateDuesAction } from "@/app/actions";
import {
  Empty,
  Field,
  Flash,
  Metric,
  PageHeading,
  Panel,
  Status,
} from "@/components/ui";
import { Submit } from "@/components/form-controls";
import { DocumentForm } from "@/components/document-form";

export default async function Dues({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { t, language } = await getI18n();

  const user = await requireUser(),
    search = await searchParams,
    range = monthRange(param(search, "month"));
  const [dues, members, accounts, funds] = await Promise.all([
    db.due.findMany({
      where: {
        year: range.from.getUTCFullYear(),
        month: range.from.getUTCMonth() + 1,
      },
      include: { member: true, document: true },
      orderBy: { member: { name: "asc" } },
    }),
    db.member.findMany({ orderBy: { name: "asc" } }),
    db.account.findMany({ where: { active: true } }),
    db.fund.findMany({ where: { active: true } }),
  ]);
  const collected = dues
      .filter((d) => d.paidAt)
      .reduce((s, d) => s + d.amountSen, 0n),
    unpaid = dues
      .filter((d) => !d.paidAt)
      .reduce((s, d) => s + d.amountSen, 0n);
  const dueId = param(search, "pay");
  const selectedDue = dueId
    ? await db.due.findUnique({
        where: { id: dueId },
        include: { member: true },
      })
    : null;
  if (dueId && !selectedDue) notFound();
  return (
    <>
      <PageHeading
        title={t("Yuran ahli")}
        description={t("Pantau kutipan bulanan dan urus ahli komuniti anda.")}
      >
        {user.role !== "USER" && (
          <a className="button button-primary" href="#ahli">
            <UserPlus size={17} />
            {t("Tambah ahli")}
          </a>
        )}
      </PageHeading>
      <Flash search={search} />
      <div className="metrics-grid">
        <Metric
          featured
          label={t("Yuran diterima")}
          value={money(collected)}
          detail={uiMonth(range.month, language)}
        />
        <Metric
          label={t("Belum selesai")}
          value={money(unpaid)}
          detail={t("{count} rekod belum selesai", {
            count: dues.filter((d) => !d.paidAt).length,
          })}
        />
        <Metric
          label={t("Sudah membayar")}
          value={`${dues.filter((d) => d.paidAt).length} / ${dues.length}`}
          detail={t("Resit yang telah selesai")}
        />
        <Metric
          label={t("Jumlah ahli aktif")}
          value={String(members.filter((m) => m.active).length)}
          detail={t("Dalam daftar organisasi")}
          icon={<Users size={18} />}
        />
      </div>
      {selectedDue && !selectedDue.documentId && !selectedDue.paidAt && (
        <Panel
          title={t("Sediakan resit — {name}", {
            name: selectedDue.member.name,
          })}
          description={t(
            "Yuran {month}/{year}. Resit perlu diluluskan dan disahkan diterima sebelum yuran dikira dibayar.",
            { month: selectedDue.month, year: selectedDue.year },
          )}
        >
          <DocumentForm
            accounts={accounts}
            funds={funds}
            due={{
              id: selectedDue.id,
              name: selectedDue.member.name,
              amount: `${selectedDue.amountSen / 100n}.${(selectedDue.amountSen % 100n).toString().padStart(2, "0")}`,
            }}
          />
        </Panel>
      )}
      <Panel
        title={t("Kutipan bulanan")}
        description={uiMonth(range.month, language)}
        action={
          user.role !== "USER" ? (
            <form action={generateDuesAction}>
              <input type="hidden" name="month" value={range.month} />
              <Submit className="button button-secondary">
                <Plus size={16} />
                {t("Jana yuran bulan ini")}
              </Submit>
            </form>
          ) : undefined
        }
      >
        <form className="filter-bar">
          <Field label={t("Bulan yuran")}>
            <input
              type="month"
              name="month"
              defaultValue={range.month}
              required
            />
          </Field>
          <button className="button button-secondary">
            {t("Lihat bulan")}
          </button>
        </form>
        {dues.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("Ahli")}</th>
                  <th>{t("Yuran")}</th>
                  <th>{t("Status")}</th>
                  <th>{t("Resit / Tindakan")}</th>
                </tr>
              </thead>
              <tbody>
                {dues.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <strong className="table-primary">{d.member.name}</strong>
                      <small className="table-sub">{d.member.code}</small>
                    </td>
                    <td className="amount">{money(d.amountSen)}</td>
                    <td>
                      {d.paidAt ? (
                        <Status value="PAID" />
                      ) : d.document ? (
                        <Status value={d.document.status} />
                      ) : (
                        <span className="status status-pending">
                          <i />
                          {t("Belum dibayar")}
                        </span>
                      )}
                    </td>
                    <td>
                      {d.document ? (
                        <Link
                          className="text-link"
                          href={`/dashboard/baucer-resit/${d.document.id}`}
                        >
                          {d.document.number} →
                        </Link>
                      ) : (
                        <Link
                          className="button button-small button-secondary"
                          href={`?month=${range.month}&pay=${d.id}`}
                        >
                          {t("Sediakan resit")}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={t("Yuran belum dijana")}
            description={t(
              "Pentadbir boleh menjana yuran untuk semua ahli aktif bagi bulan ini.",
            )}
          />
        )}
      </Panel>
      {user.role !== "USER" && (
        <details className="form-disclosure" id="ahli" open>
          <summary>
            <UserPlus size={20} />
            <span>
              {t("Daftar ahli baharu")}
              <small>{t("Tetapkan kadar yuran bulanan ahli.")}</small>
            </span>
            <Plus size={18} />
          </summary>
          <form action={createMemberAction} className="form-grid">
            <Field label={t("Kod ahli")}>
              <input name="code" maxLength={30} placeholder="AH-009" required />
            </Field>
            <Field label={t("Nama penuh")}>
              <input name="name" maxLength={100} required />
            </Field>
            <Field label={t("Nombor telefon (pilihan)")}>
              <input name="phone" type="tel" maxLength={30} />
            </Field>
            <Field label={t("Yuran bulanan (RM)")}>
              <input
                name="amount"
                type="number"
                defaultValue="10.00"
                min="0.01"
                step="0.01"
                required
              />
            </Field>
            <div className="form-footer field-wide">
              <Submit>{t("member.register")}</Submit>
            </div>
          </form>
        </details>
      )}
      <Panel
        title={t("Daftar ahli")}
        description={t("{count} ahli berdaftar", { count: members.length })}
      >
        {members.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("Kod")}</th>
                  <th>{t("Nama")}</th>
                  <th>{t("Telefon")}</th>
                  <th className="align-right">{t("Yuran bulanan")}</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="muted">{m.code}</td>
                    <td>
                      <strong>{m.name}</strong>
                    </td>
                    <td>{m.phone || "—"}</td>
                    <td className="align-right amount">
                      {money(m.monthlySen)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            description={t("Daftar ahli pertama untuk mula mengurus yuran.")}
          />
        )}
      </Panel>
    </>
  );
}
