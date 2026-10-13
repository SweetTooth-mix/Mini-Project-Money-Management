import { uiDate, uiMonth, uiMonthName, uiLocale } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Plus,
  Wallet,
  Files,
  ClipboardCheck,
  Users,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { balances, ledgerData, param, type Search } from "@/lib/queries";
import { money, today } from "@/lib/money";
import { Empty, EntryTable, Metric, PageHeading, Panel } from "@/components/ui";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { t, language } = await getI18n();

  const user = await requireUser();
  const search = await searchParams;
  const [ledger, balance, pending, dues, recentAudit, pendingCount] =
    await Promise.all([
      ledgerData({ month: param(search, "month") }),
      balances(),
      db.document.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: 3,
        include: { createdBy: true },
      }),
      db.due.aggregate({
        where: { paidAt: null },
        _sum: { amountSen: true },
        _count: true,
      }),
      db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { user: { select: { name: true } } },
      }),
      db.document.count({ where: { status: "PENDING" } }),
    ]);
  const chartStart = new Date(ledger.from);
  chartStart.setUTCMonth(chartStart.getUTCMonth() - 5);
  const history = await db.ledgerEntry.findMany({
    where: {
      date: { gte: chartStart, lt: ledger.until },
      type: { in: ["INCOME", "EXPENSE"] },
    },
    select: { date: true, amountSen: true, type: true },
  });
  const buckets = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(chartStart);
    d.setUTCMonth(d.getUTCMonth() + i);
    const prefix = d.toISOString().slice(0, 7),
      rows = history.filter((e) => e.date.toISOString().startsWith(prefix));
    return {
      label: uiMonthName(d.getUTCMonth(), language, true),
      income: rows
        .filter((e) => e.type === "INCOME")
        .reduce((n, e) => n + e.amountSen, 0n),
      expense: rows
        .filter((e) => e.type === "EXPENSE")
        .reduce((n, e) => n - e.amountSen, 0n),
    };
  });
  const max = Math.max(
    1,
    ...buckets.flatMap((b) => [Number(b.income), Number(b.expense)]),
  );
  const fundMax = Math.max(
    1,
    ...balance.funds.map((f) => Math.abs(Number(f.balance))),
  );
  return (
    <>
      <PageHeading
        eyebrow={t("{date} · RUANG KERJA ANDA", {
          date: uiDate(
            new Date(`${today()}T00:00:00Z`),
            language,
          ).toUpperCase(),
        })}
        title={t("Selamat datang, {name}.", { name: user.name.split(" ")[0] })}
        description={t(
          "Semak kedudukan dana dan urusan yang perlu diselesaikan.",
        )}
      >
        <Link
          href="/dashboard/laporan-excel"
          className="button button-secondary"
        >
          <Files size={17} />
          {t("Jana laporan")}
        </Link>
        <Link
          href="/dashboard/baucer-resit#baharu"
          className="button button-primary"
        >
          <Plus size={17} />
          {t("Rekod baharu")}
        </Link>
      </PageHeading>
      <div className="section-toolbar">
        <div className="section-title-inline">
          <span className="section-dot" />
          {t("Ringkasan kewangan")}{" "}
          <span className="subtle-tag">{uiMonth(ledger.month, language)}</span>
        </div>
        <form className="month-filter">
          <CalendarDays size={16} />
          <input
            aria-label={t("Bulan ringkasan")}
            type="month"
            name="month"
            defaultValue={ledger.month}
          />
          <button type="submit" className="text-button">
            {t("Lihat")} <ArrowRight size={14} />
          </button>
        </form>
      </div>
      <div className="metrics-grid dashboard-metrics">
        <Metric
          featured
          label={t("Baki akhir bulan")}
          value={money(ledger.closing)}
          detail={t("Semua akaun dan dana")}
          icon={<Wallet size={18} />}
        />
        <Metric
          label={t("Jumlah penerimaan")}
          value={money(ledger.income)}
          detail={t("{count} penerimaan dalam tempoh", {
            count: ledger.entries.filter((e) => e.type === "INCOME").length,
          })}
          icon={<ArrowDownLeft size={18} />}
        />
        <Metric
          label={t("Jumlah perbelanjaan")}
          value={money(ledger.expense)}
          detail={t("{count} bayaran dalam tempoh", {
            count: ledger.entries.filter((e) => e.type === "EXPENSE").length,
          })}
          tone="orange"
          icon={<ArrowUpRight size={18} />}
        />
        <Metric
          label={t("Yuran belum selesai")}
          value={money(dues._sum.amountSen ?? 0n)}
          detail={t("{count} rekod · semua bulan", { count: dues._count })}
          tone="gold"
          icon={<Clock3 size={18} />}
        />
      </div>
      <nav className="task-strip" aria-label={t("Urusan kewangan")}>
        <Link href="/dashboard/baucer-resit?status=PENDING">
          <span className="task-icon">
            <ClipboardCheck size={20} />
          </span>
          <span>
            <strong>
              {pendingCount
                ? t("{count} dokumen perlu disemak", { count: pendingCount })
                : t("Tiada dokumen menunggu semakan")}
            </strong>
            <small>{t("Buka senarai kelulusan")}</small>
          </span>
          <ArrowUpRight size={17} />
        </Link>
        <Link href="/dashboard/yuran">
          <span className="task-icon">
            <Users size={20} />
          </span>
          <span>
            <strong>
              {t("{count} rekod yuran belum selesai", { count: dues._count })}
            </strong>
            <small>{t("Semak kutipan ahli")}</small>
          </span>
          <ArrowUpRight size={17} />
        </Link>
        <Link href="/dashboard/laporan-excel">
          <span className="task-icon">
            <Files size={20} />
          </span>
          <span>
            <strong>{t("Laporan untuk dibentangkan")}</strong>
            <small>{t("Excel berpaut & PDF format asal")}</small>
          </span>
          <ArrowUpRight size={17} />
        </Link>
      </nav>
      <div className="dashboard-main-grid">
        <Panel
          title={t("Aliran tunai")}
          description={t("Penerimaan dan perbelanjaan sepanjang 6 bulan")}
          action={
            <div className="chart-legend">
              <span>
                <i className="legend-income" />
                {t("Masuk")}
              </span>
              <span>
                <i className="legend-expense" />
                {t("Keluar")}
              </span>
            </div>
          }
        >
          <div className="chart">
            <div className="chart-y-labels">
              {[1, 0.75, 0.5, 0.25, 0].map((x) => (
                <span key={x}>{money(BigInt(Math.round(max * x)), false)}</span>
              ))}
            </div>
            <div className="chart-plot">
              <div className="chart-grid-lines">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="bar-groups">
                {buckets.map((b, i) => (
                  <div
                    className={`bar-group ${i === 5 ? "current" : ""}`}
                    key={b.label}
                  >
                    <div className="bars">
                      <div
                        className="bar bar-income"
                        style={{
                          height: `${(Number(b.income) / max) * 100}%`,
                          minHeight: b.income > 0n ? 3 : 0,
                        }}
                        title={t("{month}: penerimaan {amount}", {
                          month: b.label,
                          amount: money(b.income),
                        })}
                      />
                      <div
                        className="bar bar-expense"
                        style={{
                          height: `${(Number(b.expense) / max) * 100}%`,
                          minHeight: b.expense > 0n ? 3 : 0,
                        }}
                        title={t("{month}: perbelanjaan {amount}", {
                          month: b.label,
                          amount: money(b.expense),
                        })}
                      />
                    </div>
                    <span>{b.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="chart-summary">
            <span>
              <i className="section-dot" />
              {t("Lebihan / defisit bulan dipilih")}
            </span>
            <strong
              className={
                ledger.income - ledger.expense >= 0n ? "text-green" : "text-red"
              }
            >
              {money(ledger.income - ledger.expense)}
            </strong>
          </div>
          <details className="accessible-chart">
            <summary>{t("Lihat data carta")}</summary>
            <table>
              <caption>{t("Aliran tunai enam bulan")}</caption>
              <thead>
                <tr>
                  <th>{t("Bulan")}</th>
                  <th>{t("Penerimaan")}</th>
                  <th>{t("Perbelanjaan")}</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b) => (
                  <tr key={b.label}>
                    <td>{b.label}</td>
                    <td>{money(b.income)}</td>
                    <td>{money(b.expense)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Panel>
        <Panel
          title={t("Baki mengikut dana")}
          description={t("Kedudukan semasa semua dana")}
          action={
            <Link
              href="/dashboard/akaun"
              className="icon-link"
              aria-label={t("Lihat akaun dan dana")}
            >
              <ArrowUpRight size={20} />
            </Link>
          }
        >
          <div className="fund-list">
            {balance.funds.map((f) => (
              <div className="fund-item" key={f.id}>
                <div>
                  <span className="fund-label">
                    <i style={{ background: f.color }} />
                    {f.name}
                  </span>
                  <strong className={f.balance < 0n ? "text-red" : ""}>
                    {money(f.balance)}
                  </strong>
                </div>
                <div className="fund-track">
                  <i
                    style={{
                      background: f.color,
                      width: `${(Math.abs(Number(f.balance)) / fundMax) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="fund-total">
            <span>{t("Jumlah baki semasa")}</span>
            <strong>
              {money(balance.funds.reduce((s, f) => s + f.balance, 0n))}
            </strong>
          </div>
          <div className="panel-footnote">
            {t("Setiap transaksi dikaitkan kepada satu dana.")}
          </div>
        </Panel>
      </div>
      <div className="dashboard-lower-grid">
        <Panel
          title={t("Transaksi terkini")}
          description={t("Rekod dalam {month}", {
            month: uiMonth(ledger.month, language),
          })}
          action={
            <Link
              className="text-link"
              href={`/dashboard/buku-tunai?month=${ledger.month}`}
            >
              {t("Semua transaksi")} <ArrowRight size={15} />
            </Link>
          }
        >
          <EntryTable entries={ledger.entries.slice(-5).reverse()} compact />
        </Panel>
        <Panel
          title={t("Perlu perhatian")}
          description={t("Dokumen menunggu semakan")}
          action={<span className="count-pill">{pendingCount}</span>}
        >
          <div className="approval-list">
            {pending.length ? (
              pending.map((d) => (
                <Link
                  className="approval-card"
                  key={d.id}
                  href={`/dashboard/baucer-resit/${d.id}`}
                >
                  <div className="approval-card-top">
                    <small>{d.number}</small>
                    <ArrowUpRight size={16} />
                  </div>
                  <strong>{d.description}</strong>
                  <div>
                    <span>{d.createdBy.name}</span>
                    <b>{money(d.amountSen)}</b>
                  </div>
                </Link>
              ))
            ) : (
              <Empty
                title={t("Semua sudah disemak")}
                description={t("Tiada dokumen menunggu kelulusan.")}
              />
            )}
          </div>
          <Link
            className="panel-bottom-link"
            href="/dashboard/baucer-resit?status=PENDING"
          >
            {t("Buka senarai kelulusan")} <ArrowRight size={16} />
          </Link>
        </Panel>
      </div>
      <Panel
        title={t("Aktiviti terkini")}
        description={t("Jejak perubahan untuk ketelusan bersama")}
        action={
          <Link href="/dashboard/audit" className="text-link">
            {t("Lihat jejak audit")} <ArrowRight size={15} />
          </Link>
        }
      >
        <div className="activity-strip">
          {recentAudit.map((a) => (
            <div className="activity-item" key={a.id}>
              <span className="activity-dot" />
              <div>
                <strong>{a.user.name}</strong>
                <p>{a.detail}</p>
                <small>
                  {new Intl.DateTimeFormat(uiLocale(language), {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Kuala_Lumpur",
                  }).format(a.createdAt)}
                </small>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
