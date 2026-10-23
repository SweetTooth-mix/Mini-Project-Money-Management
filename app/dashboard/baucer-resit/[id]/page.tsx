import { uiDate, uiLocale } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Download, FileCheck2, Paperclip, Send } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canReadDocument } from "@/lib/access";
import { money, shortDate, terbilang, today } from "@/lib/money";
import type { Search } from "@/lib/queries";
import { Field, Flash, PageHeading, Panel, Status } from "@/components/ui";
import { Submit } from "@/components/form-controls";
import { documentAction, uploadAction } from "@/app/actions";
import { DocumentForm } from "@/components/document-form";
import { Disclosure } from "@/components/disclosure";
import { ExcelExport } from "@/components/excel-export";

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  const { t, language } = await getI18n();

  const user = await requireUser(),
    { id } = await params;
  const [doc, currentOrg, events] = await Promise.all([
    db.document.findUnique({
      where: { id },
      include: {
        fund: true,
        account: true,
        createdBy: true,
        approvedBy: true,
        attachment: true,
        entry: true,
        due: true,
      },
    }),
    db.organization.findUniqueOrThrow({ where: { id: "main" } }),
    db.auditLog.findMany({
      where: { entityId: id },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true } } },
    }),
  ]);
  if (!doc) notFound();
  const org =
    doc.snapshot && typeof doc.snapshot === "object"
      ? (doc.snapshot as Record<string, string>)
      : currentOrg;
  const admin = user.role !== "USER";
  const editable = doc.status === "DRAFT" && doc.createdById === user.id;
  // Same rule the download route applies, so the link is never offered for a
  // file the route would refuse.
  const readable = canReadDocument(user, doc);
  const [accounts, funds] = editable
    ? await Promise.all([
        db.account.findMany({ where: { active: true } }),
        db.fund.findMany({ where: { active: true } }),
      ])
    : [[], []];
  const amount = `${doc.amountSen / 100n}.${(doc.amountSen % 100n).toString().padStart(2, "0")}`;
  const steps = [
    t("Draf disediakan"),
    t("Dihantar"),
    t("Diluluskan"),
    t("Bayaran direkod"),
  ];
  const currentStep = ["DRAFT", "PENDING", "APPROVED", "PAID"].indexOf(
    doc.status,
  );
  return (
    <>
      <div className="no-print">
        <Link href="/dashboard/baucer-resit" className="back-link">
          {t("← Semua dokumen")}
        </Link>
        <PageHeading
          eyebrow={
            doc.type === "BAUCER" ? t("BAUCER BAYARAN") : t("RESIT PENERIMAAN")
          }
          title={doc.number}
          description={t("Disediakan oleh {name} · {date}", {
            name: doc.createdBy.name,
            date: uiDate(doc.date, language),
          })}
        >
          <Status value={doc.status} />
        </PageHeading>
        <ExcelExport document={doc.id} year={doc.date.getUTCFullYear()} />
        <Flash search={await searchParams} />
        <div className="workflow-steps">
          {steps.map((s, i) => (
            <div className={i <= currentStep ? "complete" : ""} key={s}>
              <span>{i < currentStep ? <Check size={14} /> : i + 1}</span>
              {s}
            </div>
          ))}
        </div>
      </div>
      <div className="document-layout">
        <article className="print-sheet" lang="ms">
          <header className="document-letterhead">
            <div>
              <span className="document-org-mark">KR</span>
              <h2>{org.name}</h2>
              <p>{org.address}</p>
              <p>{[org.phone, org.email].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="document-title-block">
              <p>
                {doc.type === "BAUCER" ? "BAUCER BAYARAN" : "RESIT PENERIMAAN"}
              </p>
              <strong>{doc.number}</strong>
              <span>{shortDate(doc.date)}</span>
            </div>
          </header>
          {doc.status !== "PAID" && (
            <div className="document-watermark">
              {doc.status === "VOID"
                ? "DIBATALKAN"
                : doc.status === "REJECTED"
                  ? "DITOLAK"
                  : "BELUM DIREKOD SEBAGAI DIBAYAR"}
            </div>
          )}
          <div className="document-parties">
            <div>
              <small>
                {doc.type === "BAUCER" ? "BAYAR KEPADA" : "DITERIMA DARIPADA"}
              </small>
              <h3>{doc.party}</h3>
              <span>{doc.fund.name}</span>
            </div>
            <div>
              <small>KAEDAH BAYARAN</small>
              <strong>
                {doc.paymentMethod === "BANK" ? "Pindahan bank / cek" : "Tunai"}
              </strong>
              <span>{doc.reference || "Tiada rujukan tambahan"}</span>
            </div>
          </div>
          <table className="document-lines">
            <thead>
              <tr>
                <th>Butiran</th>
                <th className="align-right">Amaun (RM)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>{doc.description}</strong>
                  <small>
                    {doc.category} · {doc.account.name}
                  </small>
                </td>
                <td className="align-right amount">
                  {money(doc.amountSen, false)}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <th>Jumlah</th>
                <td className="align-right">{money(doc.amountSen)}</td>
              </tr>
            </tfoot>
          </table>
          <div className="amount-words">
            <small>RINGGIT MALAYSIA</small>
            <p>{terbilang(doc.amountSen)}</p>
          </div>
          {doc.note && (
            <div className="document-note">
              <strong>Catatan</strong>
              <p>{doc.note}</p>
            </div>
          )}
          <div className="signatures">
            <div>
              <span>Disediakan oleh</span>
              <div className="signature-line" />
              <strong>{doc.createdBy.name}</strong>
              <small>{org.preparedBy || "Penyedia"}</small>
            </div>
            <div>
              <span>Disemak / diluluskan oleh</span>
              <div className="signature-line" />
              <strong>{doc.approvedBy?.name ?? "Belum diluluskan"}</strong>
              <small>{org.checkedBy || "Penyemak"}</small>
            </div>
            <div>
              <span>Pengesahan organisasi</span>
              <div className="signature-line" />
              <strong>{org.approvedBy || "Pengerusi"}</strong>
              <small>Tandatangan / cop</small>
            </div>
          </div>
          <footer className="document-print-footer">
            <span>Dijana oleh Kira Rapi · {doc.number}</span>
            <span>
              {doc.paidAt
                ? `Bayaran direkod: ${shortDate(doc.paidAt)}`
                : "Dokumen ini belum menjejaskan buku tunai."}
            </span>
          </footer>
        </article>
        <aside className="document-actions no-print">
          <Panel
            title={t("Tindakan dokumen")}
            description={t("Setiap tindakan direkod untuk audit.")}
          >
            <div className="action-stack">
              {doc.status === "DRAFT" && doc.createdById === user.id && (
                <form action={documentAction}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="action" value="submit" />
                  <p className="muted">
                    {t(
                      "Pastikan butiran dan lampiran lengkap sebelum dihantar.",
                    )}
                  </p>
                  <Submit>
                    <Send size={16} />
                    {t("Hantar untuk kelulusan")}
                  </Submit>
                </form>
              )}
              {doc.status === "PENDING" &&
                admin &&
                doc.createdById !== user.id && (
                  <>
                    <form action={documentAction}>
                      <input type="hidden" name="id" value={id} />
                      <input type="hidden" name="action" value="approve" />
                      <Submit>
                        <FileCheck2 size={16} />
                        {t("Luluskan dokumen")}
                      </Submit>
                    </form>
                    <form action={documentAction}>
                      <input type="hidden" name="id" value={id} />
                      <input type="hidden" name="action" value="reject" />
                      <Field label={t("Sebab penolakan")}>
                        <textarea
                          name="reason"
                          minLength={5}
                          maxLength={500}
                          required
                          rows={2}
                        />
                      </Field>
                      <Submit className="button button-danger">
                        {t("Tolak dokumen")}
                      </Submit>
                    </form>
                  </>
                )}
              {doc.status === "PENDING" && doc.createdById === user.id && (
                <p className="info-note">
                  {t("Dokumen anda perlu diluluskan oleh pentadbir lain.")}
                </p>
              )}
              {doc.status === "APPROVED" && admin && (
                <form action={documentAction}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="action" value="pay" />
                  <Field label={t("Tarikh bayaran sebenar")}>
                    <input
                      name="date"
                      type="date"
                      defaultValue={today()}
                      min={doc.date.toISOString().slice(0, 10)}
                      max={today()}
                      required
                    />
                  </Field>
                  <p className="muted">
                    {t(
                      doc.type === "RESIT"
                        ? "Rekodkan selepas wang benar-benar diterima. Baki akan dikemas kini sekali sahaja."
                        : "Rekodkan selepas wang benar-benar dibayar. Baki akan dikemas kini sekali sahaja.",
                    )}
                  </p>
                  <Submit>
                    {t(
                      doc.type === "RESIT"
                        ? "Sahkan penerimaan"
                        : "Sahkan bayaran",
                    )}
                  </Submit>
                </form>
              )}
              {doc.status === "PAID" && (
                <div className="paid-notice">
                  <Check size={20} />
                  <strong>{t("Telah direkod dalam buku tunai")}</strong>
                  <span>{doc.paidAt && uiDate(doc.paidAt, language)}</span>
                </div>
              )}
              {admin && !["VOID", "REJECTED"].includes(doc.status) && (
                <details className="danger-disclosure">
                  <summary>{t("Batalkan dokumen")}</summary>
                  <form action={documentAction}>
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="action" value="void" />
                    <Field label={t("Sebab pembatalan")}>
                      <textarea
                        name="reason"
                        minLength={5}
                        maxLength={500}
                        required
                        rows={2}
                      />
                    </Field>
                    {doc.status === "PAID" && (
                      <>
                        <Field label={t("Tarikh pembalikan")}>
                          <input
                            name="date"
                            type="date"
                            defaultValue={today()}
                            max={today()}
                            required
                          />
                        </Field>
                        <p className="muted">
                          {t(
                            "Rekod asal dikekalkan. Entri pembalikan akan ditambah ke buku tunai.",
                          )}
                        </p>
                      </>
                    )}
                    <Submit className="button button-danger">
                      {t("Sahkan pembatalan")}
                    </Submit>
                  </form>
                </details>
              )}
              {["VOID", "REJECTED"].includes(doc.status) && (
                <p className="muted">
                  {t(
                    "Dokumen ini telah ditutup. Cipta draf baharu jika pembetulan diperlukan.",
                  )}
                </p>
              )}
            </div>
          </Panel>
          <Panel title={t("Lampiran")} action={<Paperclip size={17} />}>
            <div className="action-stack">
              {doc.attachment && readable && (
                <a
                  href={`/api/attachments/${doc.attachment.id}`}
                  className="attachment-link"
                >
                  <Download size={16} />
                  {doc.attachment.fileName}
                </a>
              )}
              {doc.attachment && !readable && (
                <p className="muted">
                  {t(
                    "Lampiran draf hanya boleh dibuka oleh penyedia dan pentadbir.",
                  )}
                </p>
              )}
              {!doc.attachment && (
                <p className="muted">{t("Tiada lampiran.")}</p>
              )}
              {doc.status === "DRAFT" && doc.createdById === user.id && (
                <form action={uploadAction}>
                  <input type="hidden" name="id" value={id} />
                  <Field label={t("PDF, PNG atau JPEG · maks. 5 MB")}>
                    <input
                      name="file"
                      type="file"
                      accept="application/pdf,image/png,image/jpeg"
                      required
                    />
                  </Field>
                  <Submit className="button button-secondary">
                    {t("Simpan lampiran")}
                  </Submit>
                </form>
              )}
            </div>
          </Panel>
        </aside>
      </div>
      <div className="no-print">
        {editable && (
          <Disclosure
            id="sunting"
            title={t("Sunting draf")}
            description={t(
              "Butiran boleh diubah sebelum dihantar untuk kelulusan.",
            )}
          >
            <DocumentForm
              accounts={accounts}
              funds={funds}
              due={
                doc.due
                  ? { id: doc.due.id, name: doc.party, amount }
                  : undefined
              }
              initial={{
                id: doc.id,
                type: doc.type,
                date: doc.date.toISOString().slice(0, 10),
                party: doc.party,
                amount,
                description: doc.description,
                accountId: doc.accountId,
                fundId: doc.fundId,
                category: doc.category,
                paymentMethod: doc.paymentMethod,
                reference: doc.reference,
              }}
            />
          </Disclosure>
        )}
        <Panel title={t("Jejak dokumen")}>
          <ol className="timeline">
            {events.map((e) => (
              <li key={e.id}>
                <span className="timeline-dot" />
                <div>
                  <strong>
                    {e.action.replace("DOKUMEN_", "").replaceAll("_", " ")}
                  </strong>
                  <p>
                    {e.user.name} · {e.detail}
                  </p>
                  <small>
                    {new Intl.DateTimeFormat(uiLocale(language), {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Kuala_Lumpur",
                    }).format(e.createdAt)}
                  </small>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </>
  );
}
