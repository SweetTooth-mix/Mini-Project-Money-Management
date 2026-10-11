import { randomUUID } from "node:crypto";
import { Prisma, type Role, type DocumentType } from "@prisma/client";
import { db } from "./db";
import { DomainError, dateOnly, today } from "./money";

export type Actor = { id: string; role: Role };
type Tx = Prisma.TransactionClient;
export function manager(actor: Actor) {
  if (actor.role === "USER")
    throw new DomainError("Tindakan ini memerlukan peranan pentadbir.");
}
export function superAdmin(actor: Actor) {
  if (actor.role !== "SUPER_ADMIN")
    throw new DomainError("Tindakan ini memerlukan Super Admin.");
}
export async function audit(
  tx: Tx,
  actor: Actor,
  action: string,
  entityId: string,
  detail: string,
) {
  await tx.auditLog.create({
    data: { userId: actor.id, action, entityId, detail },
  });
}

/** A short, per-organisation lock serializes financial writes and period closing. */
export async function financialWrite<T>(
  actor: Actor,
  operation: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = 'main' FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: actor.id } });
      if (!user || user.status !== "ACTIVE" || user.role !== actor.role)
        throw new DomainError("Sesi berubah. Sila log masuk semula.");
      return operation(tx);
    },
    { maxWait: 10_000, timeout: 15_000 },
  );
}
async function openPeriod(tx: Tx, date: Date) {
  const org = await tx.organization.findUniqueOrThrow({
    where: { id: "main" },
  });
  if (org.closedThrough && date <= org.closedThrough)
    throw new DomainError("Tempoh kewangan ini telah dikunci.");
  if (date > dateOnly(today()))
    throw new DomainError(
      "Transaksi tidak boleh dipos pada tarikh masa hadapan.",
    );
}
async function activeReferences(tx: Tx, accountId: string, fundId: string) {
  const [account, fund] = await Promise.all([
    tx.account.findUnique({ where: { id: accountId } }),
    tx.fund.findUnique({ where: { id: fundId } }),
  ]);
  if (!account?.active || !fund?.active)
    throw new DomainError("Pilih akaun dan dana yang aktif.");
}
async function number(tx: Tx, prefix: string, date: Date) {
  const key = `${prefix}-${date.getUTCFullYear()}`;
  const counter = await tx.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${key}-${counter.value.toString().padStart(5, "0")}`;
}

export type DocumentInput = {
  type: DocumentType;
  date: Date;
  party: string;
  description: string;
  category: string;
  amountSen: bigint;
  accountId: string;
  fundId: string;
  paymentMethod: string;
  reference: string;
};
export async function createDocument(
  actor: Actor,
  input: DocumentInput,
  dueId?: string,
) {
  if (input.amountSen <= 0n)
    throw new DomainError("Amaun mesti lebih daripada sifar.");
  return financialWrite(actor, async (tx) => {
    await openPeriod(tx, input.date);
    await activeReferences(tx, input.accountId, input.fundId);
    let data = input;
    if (dueId) {
      const due = await tx.due.findUnique({
        where: { id: dueId },
        include: { member: true },
      });
      if (!due || due.documentId || due.paidAt)
        throw new DomainError(
          "Yuran sudah mempunyai resit atau telah dibayar.",
        );
      data = {
        ...input,
        type: "RESIT",
        amountSen: due.amountSen,
        party: due.member.name,
        category: "Yuran ahli",
        description: `Yuran ${due.month}/${due.year} — ${due.member.name}`,
      };
    }
    const document = await tx.document.create({
      data: {
        ...data,
        number: await number(
          tx,
          data.type === "RESIT" ? "RS" : "BV",
          data.date,
        ),
        createdById: actor.id,
      },
    });
    if (dueId)
      await tx.due.update({
        where: { id: dueId },
        data: { documentId: document.id },
      });
    await audit(
      tx,
      actor,
      "DOKUMEN_CIPTA",
      document.id,
      `${document.number}: ${document.party}`,
    );
    return document;
  });
}

export async function updateDocument(
  actor: Actor,
  id: string,
  input: DocumentInput,
) {
  if (input.amountSen <= 0n)
    throw new DomainError("Amaun mesti lebih daripada sifar.");
  return financialWrite(actor, async (tx) => {
    const doc = await tx.document.findUnique({
      where: { id },
      include: { due: { include: { member: true } } },
    });
    if (!doc || doc.status !== "DRAFT" || doc.createdById !== actor.id)
      throw new DomainError("Hanya penyedia boleh menyunting draf sendiri.");
    if (
      doc.type !== input.type ||
      doc.date.getUTCFullYear() !== input.date.getUTCFullYear()
    )
      throw new DomainError(
        "Untuk menukar jenis atau tahun dokumen, cipta draf baharu.",
      );
    await openPeriod(tx, input.date);
    await activeReferences(tx, input.accountId, input.fundId);
    const data = doc.due
      ? {
          ...input,
          type: "RESIT" as const,
          amountSen: doc.due.amountSen,
          party: doc.due.member.name,
          category: "Yuran ahli",
          description: `Yuran ${doc.due.month}/${doc.due.year} — ${doc.due.member.name}`,
        }
      : input;
    await tx.document.update({ where: { id }, data });
    await audit(
      tx,
      actor,
      "DOKUMEN_SUNTING",
      id,
      `${doc.number}: amaun ${doc.amountSen} → ${data.amountSen} sen; akaun ${doc.accountId} → ${data.accountId}; dana ${doc.fundId} → ${data.fundId}`,
    );
  });
}

export async function transitionDocument(
  actor: Actor,
  id: string,
  action: "submit" | "approve" | "reject" | "pay" | "void",
  reason = "",
  bookingDate = dateOnly(today()),
) {
  return financialWrite(actor, async (tx) => {
    const doc = await tx.document.findUnique({
      where: { id },
      include: { entry: true },
    });
    if (!doc) throw new DomainError("Dokumen tidak dijumpai.");
    if (action === "submit") {
      if (doc.createdById !== actor.id)
        throw new DomainError("Hanya penyedia boleh menghantar dokumen ini.");
      if (doc.status !== "DRAFT")
        throw new DomainError("Hanya draf boleh dihantar untuk kelulusan.");
      await tx.document.update({ where: { id }, data: { status: "PENDING" } });
    } else {
      manager(actor);
      if (action === "approve" || action === "reject") {
        if (doc.status !== "PENDING")
          throw new DomainError("Dokumen ini tidak menunggu kelulusan.");
        if (doc.createdById === actor.id)
          throw new DomainError("Dokumen mesti disemak oleh pentadbir lain.");
        if (action === "reject" && reason.trim().length < 5)
          throw new DomainError(
            "Nyatakan sebab penolakan (sekurang-kurangnya 5 aksara).",
          );
        const org = await tx.organization.findUniqueOrThrow({
          where: { id: "main" },
        });
        const snapshot = {
          name: org.name,
          address: org.address,
          email: org.email,
          phone: org.phone,
          preparedBy: org.preparedBy,
          checkedBy: org.checkedBy,
          approvedBy: org.approvedBy,
        };
        await tx.document.update({
          where: { id },
          data:
            action === "approve"
              ? {
                  status: "APPROVED",
                  approvedById: actor.id,
                  approvedAt: new Date(),
                  snapshot,
                }
              : { status: "REJECTED", note: reason },
        });
        if (action === "reject")
          await tx.due.updateMany({
            where: { documentId: id },
            data: { documentId: null, paidAt: null },
          });
      } else if (action === "pay") {
        if (doc.status !== "APPROVED")
          throw new DomainError(
            "Hanya dokumen diluluskan boleh direkodkan sebagai dibayar.",
          );
        await openPeriod(tx, bookingDate);
        await activeReferences(tx, doc.accountId, doc.fundId);
        if (bookingDate < doc.date)
          throw new DomainError(
            "Tarikh bayaran tidak boleh mendahului tarikh dokumen.",
          );
        await tx.ledgerEntry.create({
          data: {
            date: bookingDate,
            type: doc.type === "RESIT" ? "INCOME" : "EXPENSE",
            amountSen: doc.type === "RESIT" ? doc.amountSen : -doc.amountSen,
            accountId: doc.accountId,
            fundId: doc.fundId,
            documentId: id,
            description: doc.description,
            category: doc.category,
            reference: doc.number,
          },
        });
        await tx.document.update({
          where: { id },
          data: { status: "PAID", paidAt: bookingDate },
        });
        await tx.due.updateMany({
          where: { documentId: id },
          data: { paidAt: bookingDate },
        });
      } else if (action === "void") {
        if (reason.trim().length < 5)
          throw new DomainError(
            "Nyatakan sebab pembatalan (sekurang-kurangnya 5 aksara).",
          );
        if (["VOID", "REJECTED"].includes(doc.status))
          throw new DomainError("Dokumen ini telah ditutup.");
        if (doc.status === "PAID") {
          if (!doc.entry) throw new DomainError("Rekod ledger tidak dijumpai.");
          await openPeriod(tx, bookingDate);
          if (bookingDate < doc.entry.date)
            throw new DomainError(
              "Tarikh pembalikan tidak boleh mendahului bayaran asal.",
            );
          await tx.ledgerEntry.create({
            data: {
              date: bookingDate,
              type: "REVERSAL",
              amountSen: -doc.entry.amountSen,
              accountId: doc.accountId,
              fundId: doc.fundId,
              reversalOfId: doc.entry.id,
              description: `Pembalikan ${doc.number}: ${reason}`,
              category: doc.category,
              reference: `PB-${doc.number}`,
            },
          });
        }
        await tx.document.update({
          where: { id },
          data: { status: "VOID", note: reason },
        });
        await tx.due.updateMany({
          where: { documentId: id },
          data: { documentId: null, paidAt: null },
        });
      }
    }
    await audit(
      tx,
      actor,
      `DOKUMEN_${action.toUpperCase()}`,
      id,
      `${doc.number}${reason ? `: ${reason}` : ""}`,
    );
  });
}

export async function transfer(
  actor: Actor,
  input: {
    fromId: string;
    toId: string;
    fundId: string;
    amountSen: bigint;
    date: Date;
    description: string;
  },
) {
  manager(actor);
  if (input.fromId === input.toId || input.amountSen <= 0n)
    throw new DomainError("Pilih akaun berbeza dan amaun positif.");
  return financialWrite(actor, async (tx) => {
    await openPeriod(tx, input.date);
    await activeReferences(tx, input.fromId, input.fundId);
    await activeReferences(tx, input.toId, input.fundId);
    const transferId = randomUUID();
    const reference = await number(tx, "TR", input.date);
    const common = {
      date: input.date,
      description: input.description,
      category: "Pindahan dalaman",
      fundId: input.fundId,
      transferId,
      reference,
    };
    await tx.ledgerEntry.createMany({
      data: [
        {
          ...common,
          accountId: input.fromId,
          amountSen: -input.amountSen,
          type: "TRANSFER_OUT",
        },
        {
          ...common,
          accountId: input.toId,
          amountSen: input.amountSen,
          type: "TRANSFER_IN",
        },
      ],
    });
    await audit(tx, actor, "PINDAHAN", transferId, reference);
    return transferId;
  });
}

export async function createAccount(
  actor: Actor,
  input: {
    code: string;
    name: string;
    type: "BANK" | "CASH" | "OTHER";
    openingSen: bigint;
    fundId: string;
    date: Date;
  },
) {
  manager(actor);
  return financialWrite(actor, async (tx) => {
    await openPeriod(tx, input.date);
    const fund = await tx.fund.findUnique({ where: { id: input.fundId } });
    if (!fund?.active) throw new DomainError("Dana tidak sah.");
    if (input.openingSen < 0n)
      throw new DomainError("Baki pembukaan mesti sifar atau positif.");
    const account = await tx.account.create({
      data: { code: input.code, name: input.name, type: input.type },
    });
    if (input.openingSen)
      await tx.ledgerEntry.create({
        data: {
          accountId: account.id,
          fundId: input.fundId,
          date: input.date,
          type: "OPENING",
          amountSen: input.openingSen,
          category: "Baki pembukaan",
          description: `Baki pembukaan ${account.name}`,
          reference: `OPEN-${account.code}`,
        },
      });
    await audit(tx, actor, "AKAUN_CIPTA", account.id, account.name);
    return account;
  });
}

export async function closePeriod(actor: Actor, date: Date | null) {
  superAdmin(actor);
  return financialWrite(actor, async (tx) => {
    if (date && date >= dateOnly(today()))
      throw new DomainError("Hanya tempoh sebelum hari ini boleh dikunci.");
    await tx.organization.update({
      where: { id: "main" },
      data: { closedThrough: date },
    });
    await audit(
      tx,
      actor,
      "TEMPOH_KUNCI",
      "main",
      date ? date.toISOString().slice(0, 10) : "Tempoh dibuka semula",
    );
  });
}
