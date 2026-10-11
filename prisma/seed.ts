import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../lib/db";
import {
  createAccount,
  createDocument,
  transitionDocument,
} from "../lib/finance";
import { dateOnly, today } from "../lib/money";

async function seed() {
  const email = (
    process.env.SEED_ADMIN_EMAIL || "admin@kira-rapi.local"
  ).toLowerCase();
  let admin = await db.user.findUnique({ where: { email } });
  if (!admin) {
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!password || password.length < 12 || password.startsWith("CHANGE_ME"))
      throw new Error(
        "Set a private SEED_ADMIN_PASSWORD (12+ characters) before seeding.",
      );
    admin = await db.user.create({
      data: {
        email,
        name: "Pentadbir Kira Rapi",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        passwordHash: await bcrypt.hash(password, 12),
      },
    });
  }
  const exists = await db.organization.findUnique({ where: { id: "main" } });
  if (exists) {
    console.log(
      "Organisation already exists. Existing records and passwords preserved.",
    );
    return;
  }
  const demo = process.env.SEED_DEMO === "true";
  await db.organization.create({
    data: {
      id: "main",
      name: demo ? "JKKR Kampung Harmoni" : "Organisasi Saya",
      address: demo ? "Balai Raya Kampung Harmoni, Selangor" : "",
      preparedBy: "Bendahari",
      checkedBy: "Setiausaha",
      approvedBy: "Pengerusi",
    },
  });
  const funds = await Promise.all(
    [
      { code: "GAB_JKKR", name: "Dana Pengurusan", color: "#247657" },
      { code: "AC_TUMPANG", name: "Akaun Tumpang", color: "#a57a32" },
      { code: "DANA_KEROHANIAN", name: "Dana Kerohanian", color: "#637fa3" },
      { code: "LAIN2", name: "Dana Lain-lain", color: "#9971a2" },
    ].map((data) => db.fund.create({ data })),
  );
  const start = dateOnly(`${today().slice(0, 4)}-01-01`);
  const bank = await createAccount(admin, {
    code: "BANK-01",
    name: "Akaun Bank Utama",
    type: "BANK",
    openingSen: demo ? 3_240_000n : 0n,
    fundId: funds[0].id,
    date: start,
  });
  const cash = await createAccount(admin, {
    code: "CASH-01",
    name: "Peti Tunai",
    type: "CASH",
    openingSen: demo ? 65_000n : 0n,
    fundId: funds[0].id,
    date: start,
  });
  if (!demo) {
    console.log("Organisation, funds and empty accounts created.");
    return;
  }
  const reviewerPassword = process.env.SEED_REVIEWER_PASSWORD;
  if (!reviewerPassword || reviewerPassword.length < 12)
    throw new Error("Set SEED_REVIEWER_PASSWORD for local demo.");
  const reviewer = await db.user.create({
    data: {
      email: "penyemak@kira-rapi.local",
      name: "Nur Aisyah",
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash: await bcrypt.hash(reviewerPassword, 12),
    },
  });
  const month = today().slice(0, 7);
  const samples = [
    {
      day: 1,
      type: "RESIT" as const,
      party: "Pejabat Daerah",
      description: "Peruntukan pengurusan kampung",
      category: "Peruntukan",
      amountSen: 850_000n,
      fund: 0,
    },
    {
      day: 2,
      type: "BAUCER" as const,
      party: "Kedai Alat Tulis Maju",
      description: "Keperluan pejabat dan alat tulis",
      category: "Pentadbiran",
      amountSen: 28_500n,
      fund: 0,
    },
    {
      day: 3,
      type: "RESIT" as const,
      party: "Penduduk Kampung Harmoni",
      description: "Sumbangan program kerohanian",
      category: "Sumbangan",
      amountSen: 125_000n,
      fund: 2,
    },
    {
      day: 4,
      type: "BAUCER" as const,
      party: "Sinar Bersih Enterprise",
      description: "Penyelenggaraan kawasan balai raya",
      category: "Penyelenggaraan",
      amountSen: 75_000n,
      fund: 0,
    },
    {
      day: 5,
      type: "RESIT" as const,
      party: "Persatuan Belia Harmoni",
      description: "Sewaan dewan komuniti",
      category: "Sewaan",
      amountSen: 45_000n,
      fund: 0,
    },
    {
      day: 6,
      type: "BAUCER" as const,
      party: "Dapur Kak Ina",
      description: "Jamuan mesyuarat jawatankuasa",
      category: "Program komuniti",
      amountSen: 36_000n,
      fund: 0,
    },
    {
      day: 7,
      type: "RESIT" as const,
      party: "Tabung Aktiviti Penduduk",
      description: "Simpanan amanah aktiviti penduduk",
      category: "Amanah",
      amountSen: 250_000n,
      fund: 1,
    },
    {
      day: 8,
      type: "BAUCER" as const,
      party: "Tenaga Nasional Berhad",
      description: "Bil elektrik balai raya",
      category: "Utiliti",
      amountSen: 18_750n,
      fund: 0,
    },
  ];
  for (const sample of samples) {
    const { day, fund, ...fields } = sample;
    const date = dateOnly(
      `${month}-${String(Math.min(sample.day, Number(today().slice(8)))).padStart(2, "0")}`,
    );
    const doc = await createDocument(admin, {
      ...fields,
      date,
      fundId: funds[fund].id,
      accountId: bank.id,
      paymentMethod: "BANK",
      reference: "Data demonstrasi",
    });
    await transitionDocument(admin, doc.id, "submit");
    await transitionDocument(reviewer, doc.id, "approve");
    await transitionDocument(admin, doc.id, "pay", "", date);
  }
  for (let offset = 5; offset >= 1; offset--) {
    const date = dateOnly(`${month}-01`);
    date.setUTCMonth(date.getUTCMonth() - offset);
    if (date < start) continue;
    for (const type of ["RESIT", "BAUCER"] as const) {
      const amountSen =
        type === "RESIT"
          ? BigInt(480000 + (6 - offset) * 73000)
          : BigInt(310000 + (offset % 3) * 51000);
      const doc = await createDocument(admin, {
        type,
        date,
        party: type === "RESIT" ? "Pejabat Daerah" : "Program Kampung Harmoni",
        description:
          type === "RESIT"
            ? "Peruntukan bulanan komuniti"
            : "Perbelanjaan program komuniti",
        category: type === "RESIT" ? "Peruntukan" : "Program komuniti",
        amountSen,
        fundId: funds[0].id,
        accountId: bank.id,
        paymentMethod: "BANK",
        reference: "Data demonstrasi",
      });
      await transitionDocument(admin, doc.id, "submit");
      await transitionDocument(reviewer, doc.id, "approve");
      await transitionDocument(admin, doc.id, "pay", "", date);
    }
  }
  for (const [index, name] of [
    "Ahmad bin Hassan",
    "Siti Aminah",
    "Lim Wei Ming",
    "Nurul Huda",
    "Raj Kumar",
    "Faridah binti Ali",
    "Mohd Azlan",
    "Tan Mei Ling",
  ].entries()) {
    const member = await db.member.create({
      data: {
        code: `AH-${String(index + 1).padStart(3, "0")}`,
        name,
        monthlySen: 1000n,
      },
    });
    const due = await db.due.create({
      data: {
        memberId: member.id,
        year: Number(month.slice(0, 4)),
        month: Number(month.slice(5)),
        amountSen: 1000n,
      },
    });
    if (index < 5) {
      const doc = await createDocument(
        admin,
        {
          type: "RESIT",
          date: dateOnly(today()),
          party: name,
          description: "Yuran ahli",
          category: "Yuran ahli",
          amountSen: 1000n,
          fundId: funds[0].id,
          accountId: cash.id,
          paymentMethod: "TUNAI",
          reference: "",
        },
        due.id,
      );
      await transitionDocument(admin, doc.id, "submit");
      await transitionDocument(reviewer, doc.id, "approve");
      await transitionDocument(admin, doc.id, "pay");
    }
  }
  for (const [i, description] of [
    "Baik pulih lampu jalan kampung",
    "Persiapan gotong-royong bulanan",
    "Sumbangan aktiviti belia",
  ].entries()) {
    const doc = await createDocument(reviewer, {
      type: "BAUCER",
      date: dateOnly(today()),
      party: ["Cahaya Elektrik", "Koperasi Kampung", "Persatuan Belia"][i],
      description,
      category: "Program komuniti",
      amountSen: [120000n, 45000n, 80000n][i],
      fundId: funds[0].id,
      accountId: bank.id,
      paymentMethod: "BANK",
      reference: "",
    });
    await transitionDocument(reviewer, doc.id, "submit");
  }
  console.log(
    "Fictitious demo data created. Login credentials remain in the private .env file.",
  );
}
seed()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
