import { db } from "./db";
import { DomainError, terbilang } from "./money";
import type { Prisma } from "@prisma/client";

export const reportKinds = [
  "cash",
  "monthly",
  "annual",
  "tunjang",
  "tunjang-annual",
  "dues",
  "document",
] as const;
export type ExcelOptions = {
  year: number;
  month: number;
  gab?: string;
  tumpang?: string;
  rohani?: string;
  tunjang?: string;
  document?: string;
};

export async function excelData(options: ExcelOptions) {
  const { year } = options;
  const from = new Date(`${year}-01-01T00:00:00Z`);
  const until = new Date(`${year + 1}-01-01T00:00:00Z`);
  // All four workbooks use the same database snapshot, even during concurrent payments.
  return db.$transaction(
    async (tx) => {
      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: "main" },
      });
      const funds = await tx.fund.findMany({ orderBy: { code: "asc" } });
      const accounts = await tx.account.findMany();
      const pick = (id: string | undefined, codes: string[]) => {
        if (id === "none") return "";
        if (id && !funds.some((f) => f.id === id))
          throw new DomainError("Pilihan dana tidak sah.");
        return id || funds.find((f) => codes.includes(f.code))?.id || "";
      };
      const gab = pick(options.gab, ["GAB_JKKR", "GAB"]);
      const tumpang = pick(options.tumpang, ["AC_TUMPANG", "TUMPANG"]);
      const rohani = pick(options.rohani, ["DANA_KEROHANIAN", "KEROHANIAN"]);
      const selected = [gab, tumpang, rohani].filter(Boolean);
      if (new Set(selected).size !== selected.length)
        throw new DomainError("Satu dana tidak boleh dipilih dalam dua kolum.");
      const tunjangId = pick(options.tunjang || gab || undefined, [
        "GAB_JKKR",
        "GAB",
      ]);
      if (!tunjangId && !options.document)
        throw new DomainError("Pilih dana akaun tunjang sebelum jana.");
      const group = (id: string) =>
        id === gab ? 0 : id === tumpang ? 1 : id === rohani ? 2 : 3;
      const include = {
        account: true,
        fund: true,
        document: { include: { due: true } },
        reversalOf: { include: { document: { include: { due: true } } } },
      } satisfies Prisma.LedgerEntryInclude;
      const entries = options.document
        ? []
        : await tx.ledgerEntry.findMany({
            where: { date: { gte: from, lt: until } },
            include,
            orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
            take: 5001,
          });
      if (entries.length > 5000)
        throw new DomainError(
          "Eksport ini terhad kepada 5,000 catatan setahun. Hubungi pentadbir untuk eksport arkib.",
        );
      const opening = options.document
        ? []
        : await tx.ledgerEntry.groupBy({
            by: ["fundId", "accountId"],
            where: { date: { lt: from } },
            _sum: { amountSen: true },
          });
      const documents = await tx.document.findMany({
        where: options.document
          ? { id: options.document }
          : {
              date: { gte: from, lt: until },
              entry: { isNot: null },
            },
        include: { entry: true },
        orderBy: [{ date: "asc" }, { number: "asc" }],
        take: 501,
      });
      if (options.document && !documents.length)
        throw new DomainError("Dokumen tidak ditemui.");
      if (documents.length > 500)
        throw new DomainError(
          "Pakej ini terhad kepada 500 dokumen setahun. Hubungi pentadbir untuk eksport arkib.",
        );
      const dues = options.document
        ? []
        : await tx.due.findMany({
            where: { year },
            include: { member: true, document: true },
            orderBy: [{ member: { code: "asc" } }, { month: "asc" }],
            take: 5001,
          });
      if (dues.length > 5000)
        throw new DomainError(
          "Pakej ini terhad kepada 5,000 tuntutan yuran setahun.",
        );
      return {
        year,
        organization,
        generatedAt: new Date().toISOString(),
        tunjangId,
        tunjangName:
          funds.find((f) => f.id === tunjangId)?.name || "Gabungan JKKR",
        hasOther: accounts.some((a) => a.type === "OTHER"),
        entries: entries.map((e) => {
          const doc = e.document || e.reversalOf?.document;
          return {
            id: e.id,
            date: e.date.toISOString().slice(0, 10),
            type: e.type,
            originalType: e.reversalOf?.type,
            amountSen: e.amountSen.toString(),
            description: e.description,
            category: e.category,
            reference: e.reference,
            accountType: e.account.type,
            fundCode: e.fund.code,
            group: group(e.fundId),
            fundId: e.fundId,
            documentId: e.documentId,
            party: doc?.party || "",
            bankReference: doc?.reference || "",
            words: terbilang(e.amountSen < 0n ? -e.amountSen : e.amountSen),
            memberId: doc?.due?.memberId || "",
            dueYear: doc?.due?.year,
          };
        }),
        opening: opening.map((e) => ({
          fundId: e.fundId,
          group: group(e.fundId),
          fundCode: funds.find((f) => f.id === e.fundId)!.code,
          accountType: accounts.find((a) => a.id === e.accountId)!.type,
          amountSen: (e._sum.amountSen || 0n).toString(),
        })),
        documents: documents.map((d) => ({
          id: d.id,
          type: d.type,
          status: d.status,
          number: d.number,
          date: d.date.toISOString().slice(0, 10),
          party: d.party,
          description: d.description,
          amountSen: d.amountSen.toString(),
          words: terbilang(d.amountSen),
          reference: d.reference,
          entryId: d.entry?.id,
          snapshot: d.snapshot,
        })),
        dues: dues.map((d) => ({
          year: d.year,
          month: d.month,
          memberCode: d.member.code,
          memberName: d.member.name,
          amountSen: d.amountSen.toString(),
          paid: !!d.paidAt && d.document?.status === "PAID",
          reference: d.paidAt ? d.document?.reference || "" : "",
          receivedDate: d.paidAt
            ? d.document?.date.toISOString().slice(0, 10)
            : undefined,
          fundId: d.document?.fundId || "",
          documentId: d.documentId,
        })),
      };
    },
    { isolationLevel: "RepeatableRead", timeout: 30_000 },
  );
}
