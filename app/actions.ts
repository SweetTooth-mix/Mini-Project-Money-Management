"use server";

import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { endSession, requireUser, startSession } from "@/lib/auth";
import {
  audit,
  closePeriod,
  createAccount,
  createDocument,
  financialWrite,
  manager,
  superAdmin,
  transfer,
  transitionDocument,
  updateDocument,
  type Actor,
} from "@/lib/finance";
import {
  dateOnly,
  DomainError,
  monthRange,
  parseMoney,
  today,
} from "@/lib/money";
import { deleteUpload, storeUpload } from "@/lib/uploads";
import { pruneOpportunistically } from "@/lib/maintenance";

const str = (form: FormData, key: string, max = 200) =>
  z
    .string()
    .trim()
    .min(1, "Sila lengkapkan semua medan wajib.")
    .max(max, "Teks terlalu panjang.")
    .parse(form.get(key));
const optional = (form: FormData, key: string, max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .parse(form.get(key) ?? "");
const choice = <const T extends string>(
  form: FormData,
  key: string,
  options: readonly T[],
): T => z.enum(options as [T, ...T[]]).parse(form.get(key)) as T;

async function run(
  path: string,
  operation: (
    user: Actor,
  ) => Promise<{ path?: string; message?: string } | void>,
) {
  const user = await requireUser();
  let destination = path;
  let message = "Perubahan berjaya disimpan.";
  let failure = false;
  try {
    const result = await operation(user);
    destination = result?.path ?? path;
    message = result?.message ?? message;
  } catch (error) {
    failure = true;
    if (error instanceof DomainError) message = error.message;
    else if (error instanceof z.ZodError)
      message = error.issues[0]?.message ?? "Semak maklumat borang.";
    else if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      message = "Rekod dengan kod atau e-mel ini sudah wujud.";
    else {
      console.error(
        "Operation failed",
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.code
          : "internal",
      );
      message = "Perubahan tidak dapat disimpan. Sila cuba semula.";
    }
  }
  revalidatePath("/dashboard", "layout");
  redirect(
    `${destination}${destination.includes("?") ? "&" : "?"}${failure ? "error" : "success"}=${encodeURIComponent(message)}`,
  );
}

async function throttle(email: string, kind: string) {
  const key = createHash("sha256").update(`${kind}:${email}`).digest("hex");
  return db.$transaction(async (tx) => {
    await tx.loginAttempt.upsert({
      where: { key },
      create: { key },
      update: {},
    });
    await tx.$queryRaw`SELECT "key" FROM "LoginAttempt" WHERE "key" = ${key} FOR UPDATE`;
    const record = await tx.loginAttempt.findUniqueOrThrow({ where: { key } });
    const expired = record.windowStart.getTime() < Date.now() - 15 * 60 * 1000;
    if (!expired && record.attempts >= 8) return false;
    await tx.loginAttempt.update({
      where: { key },
      data: expired
        ? { attempts: 1, windowStart: new Date() }
        : { attempts: { increment: 1 } },
    });
    return true;
  });
}

export async function loginAction(form: FormData) {
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 200);
  const password = String(form.get("password") ?? "");
  if (!(await throttle(email, "login")))
    redirect(
      "/login?error=" +
        encodeURIComponent(
          "Terlalu banyak percubaan. Cuba semula selepas 15 minit.",
        ),
    );
  const user = await db.user.findUnique({ where: { email } });
  // Always perform a password hash check to reduce account enumeration via timing.
  const valid = await bcrypt.compare(
    password.slice(0, 200),
    user?.passwordHash ??
      "$2b$12$3rZPHhp0WzPYIMigmhVXvOPhGKCEoKKLX2yYNzmPlYD90qITwoe4K",
  );
  if (!user || !valid || user.status !== "ACTIVE")
    redirect(
      "/login?error=" +
        encodeURIComponent(
          "E-mel atau kata laluan tidak tepat, atau akaun belum aktif.",
        ),
    );
  await startSession(user.id);
  await pruneOpportunistically();
  redirect("/dashboard");
}
export async function logoutAction() {
  await endSession();
  redirect("/login");
}

export async function registerAction(form: FormData) {
  let error: string | null = null;
  try {
    const email = z.email().max(200).parse(str(form, "email")).toLowerCase();
    const name = str(form, "name", 100);
    const password = z
      .string()
      .min(12, "Kata laluan mesti sekurang-kurangnya 12 aksara.")
      .max(72)
      .parse(form.get("password"));
    if (!(await throttle(email, "register")))
      throw new DomainError("Terlalu banyak permohonan. Cuba lagi kemudian.");
    const exists = await db.user.findUnique({ where: { email } });
    if (!exists)
      await db.user.create({
        data: {
          email,
          name,
          passwordHash: await bcrypt.hash(password, 12),
          role: "USER",
          status: "PENDING",
        },
      });
  } catch (e) {
    error =
      e instanceof DomainError
        ? e.message
        : "Semak nama, e-mel, dan kata laluan (12–72 aksara).";
  }
  if (error) redirect(`/register?error=${encodeURIComponent(error)}`);
  redirect(
    "/login?success=" +
      encodeURIComponent(
        "Permohonan diterima. Akaun baharu perlu diaktifkan oleh pentadbir sebelum log masuk.",
      ),
  );
}

export async function createDocumentAction(form: FormData) {
  await run("/dashboard/baucer-resit", async (user) => {
    const doc = await createDocument(
      user,
      {
        type: choice(form, "type", ["RESIT", "BAUCER"]),
        date: dateOnly(str(form, "date")),
        party: str(form, "party"),
        description: str(form, "description", 1000),
        category: str(form, "category", 100),
        amountSen: parseMoney(str(form, "amount")),
        accountId: str(form, "accountId"),
        fundId: str(form, "fundId"),
        paymentMethod: choice(form, "paymentMethod", ["BANK", "TUNAI"]),
        reference: optional(form, "reference", 100),
      },
      optional(form, "dueId") || undefined,
    );
    return {
      path: `/dashboard/baucer-resit/${doc.id}`,
      message: "Draf disimpan. Semak dan hantar untuk kelulusan.",
    };
  });
}

export async function documentAction(form: FormData) {
  const id = str(form, "id", 100);
  await run(
    `/dashboard/baucer-resit/${encodeURIComponent(id)}`,
    async (user) => {
      await transitionDocument(
        user,
        id,
        choice(form, "action", ["submit", "approve", "reject", "pay", "void"]),
        optional(form, "reason"),
        dateOnly(optional(form, "date") || today()),
      );
    },
  );
}

export async function updateDocumentAction(form: FormData) {
  const id = str(form, "id", 100);
  await run(
    `/dashboard/baucer-resit/${encodeURIComponent(id)}`,
    async (user) => {
      await updateDocument(user, id, {
        type: choice(form, "type", ["RESIT", "BAUCER"]),
        date: dateOnly(str(form, "date")),
        party: str(form, "party"),
        description: str(form, "description", 1000),
        category: str(form, "category", 100),
        amountSen: parseMoney(str(form, "amount")),
        accountId: str(form, "accountId"),
        fundId: str(form, "fundId"),
        paymentMethod: choice(form, "paymentMethod", ["BANK", "TUNAI"]),
        reference: optional(form, "reference", 100),
      });
      return { message: "Draf berjaya dikemas kini." };
    },
  );
}

export async function transferAction(form: FormData) {
  await run("/dashboard/buku-tunai", async (user) => {
    await transfer(user, {
      fromId: str(form, "fromId"),
      toId: str(form, "toId"),
      fundId: str(form, "fundId"),
      amountSen: parseMoney(str(form, "amount")),
      date: dateOnly(str(form, "date")),
      description: str(form, "description"),
    });
    return { message: "Pindahan direkodkan pada kedua-dua akaun." };
  });
}

export async function createAccountAction(form: FormData) {
  await run("/dashboard/akaun", async (user) => {
    await createAccount(user, {
      code: str(form, "code", 30).toUpperCase(),
      name: str(form, "name", 100),
      type: choice(form, "type", ["BANK", "CASH", "OTHER"]),
      openingSen: parseMoney(str(form, "opening")),
      fundId: str(form, "fundId"),
      date: dateOnly(str(form, "date")),
    });
  });
}

export async function createFundAction(form: FormData) {
  await run("/dashboard/akaun", async (user) => {
    manager(user);
    await financialWrite(user, async (tx) => {
      const fund = await tx.fund.create({
        data: {
          code: str(form, "code", 30).toUpperCase(),
          name: str(form, "name", 100),
          color: /^#[0-9a-fA-F]{6}$/.test(String(form.get("color")))
            ? String(form.get("color"))
            : "#247657",
        },
      });
      await audit(tx, user, "DANA_CIPTA", fund.id, fund.name);
    });
  });
}

export async function createMemberAction(form: FormData) {
  await run("/dashboard/yuran", async (user) => {
    manager(user);
    await financialWrite(user, async (tx) => {
      const monthlySen = parseMoney(str(form, "amount"));
      if (!monthlySen)
        throw new DomainError("Yuran mesti lebih daripada sifar.");
      const member = await tx.member.create({
        data: {
          code: str(form, "code", 30),
          name: str(form, "name", 100),
          phone: optional(form, "phone", 30),
          monthlySen,
        },
      });
      await audit(tx, user, "AHLI_CIPTA", member.id, member.name);
    });
  });
}

export async function generateDuesAction(form: FormData) {
  await run("/dashboard/yuran", async (user) => {
    manager(user);
    const range = monthRange(str(form, "month"));
    const result = await financialWrite(user, async (tx) => {
      const members = await tx.member.findMany({ where: { active: true } });
      const dues = await tx.due.createMany({
        data: members.map((m) => ({
          memberId: m.id,
          amountSen: m.monthlySen,
          year: range.from.getUTCFullYear(),
          month: range.from.getUTCMonth() + 1,
        })),
        skipDuplicates: true,
      });
      await audit(
        tx,
        user,
        "YURAN_JANA",
        range.month,
        `${dues.count} rekod dijana`,
      );
      return dues;
    });
    return {
      path: `/dashboard/yuran?month=${range.month}`,
      message: `${result.count} rekod yuran baharu dijana. Rekod sedia ada dikekalkan.`,
    };
  });
}

export async function organizationAction(form: FormData) {
  await run("/dashboard/settings", async (user) => {
    superAdmin(user);
    await financialWrite(user, async (tx) => {
      await tx.organization.update({
        where: { id: "main" },
        data: {
          name: str(form, "name", 150),
          address: optional(form, "address", 300),
          email: optional(form, "email", 150),
          phone: optional(form, "phone", 30),
          preparedBy: optional(form, "preparedBy", 100),
          checkedBy: optional(form, "checkedBy", 100),
          approvedBy: optional(form, "approvedBy", 100),
        },
      });
      await audit(
        tx,
        user,
        "ORGANISASI_KEMAS_KINI",
        "main",
        "Profil dan penandatangan dikemas kini",
      );
    });
  });
}

export async function closePeriodAction(form: FormData) {
  await run("/dashboard/settings", async (user) => {
    await closePeriod(
      user,
      optional(form, "date") ? dateOnly(str(form, "date")) : null,
    );
  });
}

export async function createUserAction(form: FormData) {
  await run("/dashboard/settings", async (user) => {
    superAdmin(user);
    const password = z
      .string()
      .min(12, "Kata laluan minimum 12 aksara.")
      .max(72)
      .parse(form.get("password"));
    const passwordHash = await bcrypt.hash(password, 12);
    await financialWrite(user, async (tx) => {
      const created = await tx.user.create({
        data: {
          name: str(form, "name", 100),
          email: z.email().max(200).parse(str(form, "email")).toLowerCase(),
          passwordHash,
          role: choice(form, "role", ["USER", "ADMIN", "SUPER_ADMIN"]),
          status: "ACTIVE",
        },
      });
      await audit(
        tx,
        user,
        "PENGGUNA_CIPTA",
        created.id,
        `${created.name} (${created.role})`,
      );
    });
  });
}

export async function userStatusAction(form: FormData) {
  await run("/dashboard/settings", async (user) => {
    superAdmin(user);
    const id = str(form, "id");
    if (id === user.id)
      throw new DomainError("Status akaun sendiri tidak boleh diubah di sini.");
    await financialWrite(user, async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { status: choice(form, "status", ["ACTIVE", "DISABLED"]) },
      });
      await tx.session.deleteMany({ where: { userId: id } });
      await audit(
        tx,
        user,
        "PENGGUNA_STATUS",
        id,
        `${updated.name}: ${updated.status}`,
      );
    });
  });
}

export async function passwordAction(form: FormData) {
  await run("/dashboard/settings", async (user) => {
    const old = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    if (
      !(await bcrypt.compare(
        String(form.get("currentPassword") ?? ""),
        old.passwordHash,
      ))
    )
      throw new DomainError("Kata laluan semasa tidak tepat.");
    const password = z
      .string()
      .min(12, "Kata laluan baharu minimum 12 aksara.")
      .max(72)
      .parse(form.get("password"));
    const passwordHash = await bcrypt.hash(password, 12);
    await financialWrite(user, async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.session.deleteMany({ where: { userId: user.id } });
      await audit(
        tx,
        user,
        "KATA_LALUAN_TUKAR",
        user.id,
        "Semua sesi terdahulu ditamatkan",
      );
    });
    await startSession(user.id);
  });
}

export async function uploadAction(form: FormData) {
  const id = str(form, "id", 100);
  await run(
    `/dashboard/baucer-resit/${encodeURIComponent(id)}`,
    async (user) => {
      const stored = await storeUpload(form.get("file"));
      let previous: string | null = null;
      try {
        await financialWrite(user, async (tx) => {
          const doc = await tx.document.findUniqueOrThrow({
            where: { id },
            include: { attachment: true },
          });
          if (doc.status !== "DRAFT" || doc.createdById !== user.id)
            throw new DomainError(
              "Hanya penyedia boleh menukar lampiran draf.",
            );
          previous = doc.attachment?.storedName ?? null;
          await tx.attachment.upsert({
            where: { documentId: id },
            create: { ...stored, documentId: id },
            update: stored,
          });
          await audit(tx, user, "LAMPIRAN_SIMPAN", id, stored.fileName);
        });
      } catch (e) {
        await deleteUpload(stored.storedName);
        throw e;
      }
      if (previous) await deleteUpload(previous);
    },
  );
}
