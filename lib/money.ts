export class DomainError extends Error {}

export function parseMoney(value: string): bigint {
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value.trim())) {
    throw new DomainError(
      "Masukkan amaun yang sah dengan maksimum 2 tempat perpuluhan.",
    );
  }
  const [ringgit, sen = ""] = value.trim().split(".");
  const result = BigInt(ringgit) * 100n + BigInt(sen.padEnd(2, "0"));
  if (result > 999_999_999_999n)
    throw new DomainError("Amaun melebihi had yang dibenarkan.");
  return result;
}

export function money(value: bigint | number, currency = true): string {
  const amount = BigInt(value);
  const absolute = amount < 0n ? -amount : amount;
  return `${amount < 0n ? "−" : ""}${currency ? "RM " : ""}${new Intl.NumberFormat("ms-MY").format(absolute / 100n)}.${(absolute % 100n).toString().padStart(2, "0")}`;
}

export function dateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1900)
    throw new DomainError("Tarikh tidak sah.");
  const result = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(result.valueOf()) ||
    result.toISOString().slice(0, 10) !== value
  )
    throw new DomainError("Tarikh tidak sah.");
  return result;
}

export function today(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function shortDate(date: Date): string {
  return new Intl.DateTimeFormat("ms-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
export const months = [
  "Januari",
  "Februari",
  "Mac",
  "April",
  "Mei",
  "Jun",
  "Julai",
  "Ogos",
  "September",
  "Oktober",
  "November",
  "Disember",
];

export function monthRange(value?: string) {
  const month =
    value &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(value) &&
    Number(value.slice(0, 4)) >= 1900
      ? value
      : today().slice(0, 7);
  const from = dateOnly(`${month}-01`);
  const until = new Date(from);
  until.setUTCMonth(until.getUTCMonth() + 1);
  return {
    month,
    from,
    until,
    label: `${months[from.getUTCMonth()]} ${from.getUTCFullYear()}`,
  };
}

const words = [
  "kosong",
  "satu",
  "dua",
  "tiga",
  "empat",
  "lima",
  "enam",
  "tujuh",
  "lapan",
  "sembilan",
  "sepuluh",
  "sebelas",
];
function spell(n: bigint): string {
  if (n < 12n) return words[Number(n)];
  if (n < 20n) return `${spell(n - 10n)} belas`;
  const tail = (remainder: bigint) => (remainder ? ` ${spell(remainder)}` : "");
  if (n < 100n) return `${spell(n / 10n)} puluh${tail(n % 10n)}`;
  if (n < 200n) return `seratus${tail(n % 100n)}`;
  if (n < 1_000n) return `${spell(n / 100n)} ratus${tail(n % 100n)}`;
  if (n < 2_000n) return `seribu${tail(n % 1_000n)}`;
  for (const [divisor, label] of [
    [1_000_000_000n, "bilion"],
    [1_000_000n, "juta"],
    [1_000n, "ribu"],
  ] as const) {
    if (n >= divisor)
      return `${spell(n / divisor)} ${label}${tail(n % divisor)}`;
  }
  throw new DomainError("Amaun tidak disokong.");
}
export function terbilang(amountSen: bigint): string {
  if (amountSen < 0n) throw new DomainError("Amaun tidak boleh negatif.");
  return `${spell(amountSen / 100n)} ringgit Malaysia${amountSen % 100n ? ` dan ${spell(amountSen % 100n)} sen` : ""} sahaja`;
}
