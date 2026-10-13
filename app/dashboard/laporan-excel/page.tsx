import { uiMonthName } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";
import {
  Files,
  FileSpreadsheet,
  Link2,
  ReceiptText,
  BookOpen,
  ChartNoAxesCombined,
  Wallet,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { today, months } from "@/lib/money";
import { Field, PageHeading, Panel } from "@/components/ui";
import { ExcelExport } from "@/components/excel-export";

export default async function ExcelReports() {
  const { t, language } = await getI18n();

  await requireUser();
  const funds = await db.fund.findMany({ orderBy: { code: "asc" } });
  const current = today();
  const defaultFund = (...codes: string[]) =>
    funds.find((f) => codes.includes(f.code))?.id || "none";
  const choices = funds.map((f) => (
    <option key={f.id} value={f.id}>
      {f.name}
    </option>
  ));
  return (
    <>
      <PageHeading
        eyebrow={t("LAPORAN & DOKUMEN")}
        title={t("Jana laporan Excel")}
        description={t(
          "Rekod yang sama, dalam format yang anda kenal. Jana fail boleh edit atau PDF sedia cetak.",
        )}
      >
        <span className="report-format-tag">
          <Link2 size={16} />
          {t("4 workbook berpaut")}
        </span>
      </PageHeading>
      <section
        className="report-connection"
        aria-label={t("Aliran pautan laporan")}
      >
        <div className="report-connection-heading">
          <Files size={18} />
          <strong>{t("Satu rekod. Empat laporan.")}</strong>
          <span>{t("Susun atur template asal dikekalkan.")}</span>
        </div>
        <div className="excel-report-map">
          {[
            {
              name: t("Baucer & resit"),
              detail: t("Butiran dan amaun sumber"),
              icon: ReceiptText,
            },
            {
              name: t("Buku kewangan"),
              detail: t("Baki berjalan & pecahan dana"),
              icon: BookOpen,
            },
            {
              name: t("Bulanan & tahunan"),
              detail: t("12 bulan dan rumusan setahun"),
              icon: ChartNoAxesCombined,
            },
            {
              name: t("Akaun tunjang"),
              detail: t("Dana GAB dan rumusan yuran"),
              icon: Wallet,
            },
          ].map(({ name, detail, icon: Icon }, i) => (
            <div key={name}>
              <div className="report-map-top">
                <Icon size={21} />
                <span>0{i + 1}</span>
              </div>
              <strong>{name}</strong>
              <small>{detail}</small>
            </div>
          ))}
        </div>
      </section>
      <div className="report-generation-layout">
        <Panel
          title={t("Pilihan penjanaan")}
          description={t("Tetapkan tempoh dan dana sebelum memuat turun.")}
          className="report-options-panel"
        >
          <form className="report-form">
            <fieldset className="report-fieldset">
              <legend>
                <span>01</span>
                {t("Tempoh & jenis laporan")}
              </legend>
              <div className="form-grid">
                <Field
                  label={t("Tahun laporan")}
                  hint={t("Excel meliputi Januari–Disember.")}
                >
                  <input
                    name="year"
                    type="number"
                    min="1900"
                    max="2100"
                    defaultValue={Number(current.slice(0, 4))}
                    required
                  />
                </Field>
                <Field
                  label={t("Bulan untuk PDF")}
                  hint={t("Digunakan untuk laporan bulanan.")}
                >
                  <select
                    name="month"
                    defaultValue={Number(current.slice(5, 7))}
                  >
                    {months.map((m, i) => (
                      <option key={uiMonthName(i, language)} value={i + 1}>
                        {uiMonthName(i, language)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("Jenis PDF")} wide>
                  <select name="report" defaultValue="monthly">
                    <option value="cash">
                      {t("Buku kewangan / buku tunai")}
                    </option>
                    <option value="monthly">
                      {t("Laporan kewangan bulanan")}
                    </option>
                    <option value="annual">
                      {t("Rumusan kewangan tahunan")}
                    </option>
                    <option value="tunjang">
                      {t("Akaun tunjang bulanan")}
                    </option>
                    <option value="tunjang-annual">
                      {t("Akaun tunjang tahunan")}
                    </option>
                    <option value="dues">{t("Rumusan yuran")}</option>
                  </select>
                </Field>
              </div>
            </fieldset>
            <fieldset className="report-fieldset">
              <legend>
                <span>02</span>
                {t("Dana & pemetaan kolum")}
              </legend>
              <div className="form-grid">
                <Field
                  label={t("Dana akaun tunjang")}
                  wide
                  hint={t(
                    "Gabungan JKKR dipilih secara asal. Tukar jika laporan menggunakan dana lain.",
                  )}
                >
                  <select
                    name="tunjang"
                    defaultValue={defaultFund("GAB_JKKR", "GAB")}
                    required
                  >
                    <option value="none">{t("Pilih dana")}</option>
                    {choices}
                  </select>
                </Field>
                <details className="report-mapping field-wide">
                  <summary>
                    {t("Semak pemetaan kolum Excel")}
                    <span>{t("3 kolum dana")}</span>
                  </summary>
                  <div className="form-grid">
                    <Field label={t("Kolum GAB JKKR")} wide>
                      <select
                        name="gab"
                        defaultValue={defaultFund("GAB_JKKR", "GAB")}
                      >
                        <option value="none">{t("Tiada")}</option>
                        {choices}
                      </select>
                    </Field>
                    <Field label={t("Kolum AC Tumpang")}>
                      <select
                        name="tumpang"
                        defaultValue={defaultFund("AC_TUMPANG", "TUMPANG")}
                      >
                        <option value="none">{t("Tiada")}</option>
                        {choices}
                      </select>
                    </Field>
                    <Field label={t("Kolum Dana Kerohanian")}>
                      <select
                        name="rohani"
                        defaultValue={defaultFund(
                          "DANA_KEROHANIAN",
                          "KEROHANIAN",
                        )}
                      >
                        <option value="none">{t("Tiada")}</option>
                        {choices}
                      </select>
                    </Field>
                  </div>
                </details>
                <p className="field-wide report-field-note">
                  {t("Dana selain pilihan di atas digabungkan dalam kolum")}{" "}
                  <strong>{t("Lain2")}</strong>.
                </p>
              </div>
            </fieldset>
            <div className="report-download">
              <div className="report-download-heading">
                <FileSpreadsheet size={21} />
                <div>
                  <strong>{t("Sedia untuk dijana")}</strong>
                  <p>
                    {t(
                      "Pilih Excel boleh edit atau PDF mengikut pilihan di atas.",
                    )}
                  </p>
                </div>
              </div>
              <p className="report-field-note">
                {t("Laporan Excel dan PDF dijana dalam Bahasa Melayu.")}
              </p>
              <ExcelExport />
            </div>
          </form>
        </Panel>
        <aside className="report-guide">
          <Panel
            title={t("Cara guna fail yang dijana")}
            description={t("Pastikan pautan antara fail terus berfungsi.")}
          >
            <ol className="excel-instructions">
              <li>
                <strong>{t("Simpan dalam satu folder")}</strong>
                <p>
                  {t(
                    "Ekstrak keempat-empat fail ke folder yang sama. Kekalkan nama fail, buka semuanya dalam Excel dan kemas kini pautan.",
                  )}
                </p>
              </li>
              <li>
                <strong>{t("Edit pada helaian Data")}</strong>
                <p>
                  {t(
                    "Ubah amaun, nama, butiran atau rujukan pada fail 1. Formula menghubungkan buku kewangan, laporan bulanan dan rumusan.",
                  )}
                </p>
              </li>
              <li>
                <strong>{t("Jana semula untuk rekod baharu")}</strong>
                <p>
                  {t(
                    "Tambah transaksi atau ubah bulan, dana dan jenis akaun dalam aplikasi. Jika amaun diedit dalam Excel, kemas kini amaun dalam perkataan juga.",
                  )}
                </p>
              </li>
              <li>
                <strong>{t("Cetak daripada PDF")}</strong>
                <p>
                  {t(
                    "PDF menggunakan template Excel yang sama. Baucer/resit individu tersedia pada halaman dokumen.",
                  )}
                </p>
              </li>
            </ol>
          </Panel>
          <div className="report-note">
            <Link2 size={19} />
            <div>
              <strong>{t("Salinan boleh edit")}</strong>
              <p>
                {t(
                  "Perubahan dalam Excel tidak diselaraskan semula ke aplikasi. Simpan fail asal sebelum membuat suntingan.",
                )}
              </p>
            </div>
          </div>
          <p className="report-ledger-note">
            {t(
              "Draf tidak masuk buku kewangan. Pindahan, pembalikan dan baki pembukaan dipaparkan mengikut jenis catatan.",
            )}
          </p>
        </aside>
      </div>
    </>
  );
}
