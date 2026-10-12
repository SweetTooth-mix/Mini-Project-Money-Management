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
        eyebrow="LAPORAN & DOKUMEN"
        title="Jana laporan Excel"
        description="Rekod yang sama, dalam format yang anda kenal. Jana fail boleh edit atau PDF sedia cetak."
      >
        <span className="report-format-tag">
          <Link2 size={16} />4 workbook berpaut
        </span>
      </PageHeading>
      <section className="report-connection" aria-label="Aliran pautan laporan">
        <div className="report-connection-heading">
          <Files size={18} />
          <strong>Satu rekod. Empat laporan.</strong>
          <span>Susun atur template asal dikekalkan.</span>
        </div>
        <div className="excel-report-map">
          {[
            {
              name: "Baucer & resit",
              detail: "Butiran dan amaun sumber",
              icon: ReceiptText,
            },
            {
              name: "Buku kewangan",
              detail: "Baki berjalan & pecahan dana",
              icon: BookOpen,
            },
            {
              name: "Bulanan & tahunan",
              detail: "12 bulan dan rumusan setahun",
              icon: ChartNoAxesCombined,
            },
            {
              name: "Akaun tunjang",
              detail: "Dana GAB dan rumusan yuran",
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
          title="Pilihan penjanaan"
          description="Tetapkan tempoh dan dana sebelum memuat turun."
          className="report-options-panel"
        >
          <form className="report-form">
            <fieldset className="report-fieldset">
              <legend>
                <span>01</span>Tempoh & jenis laporan
              </legend>
              <div className="form-grid">
                <Field
                  label="Tahun laporan"
                  hint="Excel meliputi Januari–Disember."
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
                  label="Bulan untuk PDF"
                  hint="Digunakan untuk laporan bulanan."
                >
                  <select
                    name="month"
                    defaultValue={Number(current.slice(5, 7))}
                  >
                    {months.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Jenis PDF" wide>
                  <select name="report" defaultValue="monthly">
                    <option value="cash">Buku kewangan / buku tunai</option>
                    <option value="monthly">Laporan kewangan bulanan</option>
                    <option value="annual">Rumusan kewangan tahunan</option>
                    <option value="tunjang">Akaun tunjang bulanan</option>
                    <option value="tunjang-annual">
                      Akaun tunjang tahunan
                    </option>
                    <option value="dues">Rumusan yuran</option>
                  </select>
                </Field>
              </div>
            </fieldset>
            <fieldset className="report-fieldset">
              <legend>
                <span>02</span>Dana & pemetaan kolum
              </legend>
              <div className="form-grid">
                <Field
                  label="Dana akaun tunjang"
                  wide
                  hint="Gabungan JKKR dipilih secara asal. Tukar jika laporan menggunakan dana lain."
                >
                  <select
                    name="tunjang"
                    defaultValue={defaultFund("GAB_JKKR", "GAB")}
                    required
                  >
                    <option value="none">Pilih dana</option>
                    {choices}
                  </select>
                </Field>
                <details className="report-mapping field-wide">
                  <summary>
                    Semak pemetaan kolum Excel<span>3 kolum dana</span>
                  </summary>
                  <div className="form-grid">
                    <Field label="Kolum GAB JKKR" wide>
                      <select
                        name="gab"
                        defaultValue={defaultFund("GAB_JKKR", "GAB")}
                      >
                        <option value="none">Tiada</option>
                        {choices}
                      </select>
                    </Field>
                    <Field label="Kolum AC Tumpang">
                      <select
                        name="tumpang"
                        defaultValue={defaultFund("AC_TUMPANG", "TUMPANG")}
                      >
                        <option value="none">Tiada</option>
                        {choices}
                      </select>
                    </Field>
                    <Field label="Kolum Dana Kerohanian">
                      <select
                        name="rohani"
                        defaultValue={defaultFund(
                          "DANA_KEROHANIAN",
                          "KEROHANIAN",
                        )}
                      >
                        <option value="none">Tiada</option>
                        {choices}
                      </select>
                    </Field>
                  </div>
                </details>
                <p className="field-wide report-field-note">
                  Dana selain pilihan di atas digabungkan dalam kolum{" "}
                  <strong>Lain2</strong>.
                </p>
              </div>
            </fieldset>
            <div className="report-download">
              <div className="report-download-heading">
                <FileSpreadsheet size={21} />
                <div>
                  <strong>Sedia untuk dijana</strong>
                  <p>
                    Pilih Excel boleh edit atau PDF mengikut pilihan di atas.
                  </p>
                </div>
              </div>
              <ExcelExport />
            </div>
          </form>
        </Panel>
        <aside className="report-guide">
          <Panel
            title="Cara guna fail yang dijana"
            description="Pastikan pautan antara fail terus berfungsi."
          >
            <ol className="excel-instructions">
              <li>
                <strong>Simpan dalam satu folder</strong>
                <p>
                  Ekstrak keempat-empat fail ke folder yang sama. Kekalkan nama
                  fail, buka semuanya dalam Excel dan kemas kini pautan.
                </p>
              </li>
              <li>
                <strong>Edit pada helaian Data</strong>
                <p>
                  Ubah amaun, nama, butiran atau rujukan pada fail 1. Formula
                  menghubungkan buku kewangan, laporan bulanan dan rumusan.
                </p>
              </li>
              <li>
                <strong>Jana semula untuk rekod baharu</strong>
                <p>
                  Tambah transaksi atau ubah bulan, dana dan jenis akaun dalam
                  aplikasi. Jika amaun diedit dalam Excel, kemas kini amaun
                  dalam perkataan juga.
                </p>
              </li>
              <li>
                <strong>Cetak daripada PDF</strong>
                <p>
                  PDF menggunakan template Excel yang sama. Baucer/resit
                  individu tersedia pada halaman dokumen.
                </p>
              </li>
            </ol>
          </Panel>
          <div className="report-note">
            <Link2 size={19} />
            <div>
              <strong>Salinan boleh edit</strong>
              <p>
                Perubahan dalam Excel tidak diselaraskan semula ke aplikasi.
                Simpan fail asal sebelum membuat suntingan.
              </p>
            </div>
          </div>
          <p className="report-ledger-note">
            Draf tidak masuk buku kewangan. Pindahan, pembalikan dan baki
            pembukaan dipaparkan mengikut jenis catatan.
          </p>
        </aside>
      </div>
    </>
  );
}
