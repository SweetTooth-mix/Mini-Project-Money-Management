import { db } from "./db";
import { monthRange } from "./money";
import { summarize } from "./ledger";

export type Search = { [key: string]: string | string[] | undefined };
export const param = (search: Search, key: string) =>
  typeof search[key] === "string" ? (search[key] as string) : "";

export async function ledgerData(search: Search) {
  const range = monthRange(param(search, "month"));
  const accountId = param(search, "account"),
    fundId = param(search, "fund");
  const scope = {
    ...(accountId ? { accountId } : {}),
    ...(fundId ? { fundId } : {}),
  };
  const [before, entries, accounts, funds] = await db.$transaction(
    [
      db.ledgerEntry.aggregate({
        where: { ...scope, date: { lt: range.from } },
        _sum: { amountSen: true },
      }),
      db.ledgerEntry.findMany({
        where: { ...scope, date: { gte: range.from, lt: range.until } },
        include: {
          account: true,
          fund: true,
          document: { select: { party: true } },
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      }),
      db.account.findMany({ orderBy: { code: "asc" } }),
      db.fund.findMany({ orderBy: { code: "asc" } }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
  return {
    ...range,
    entries,
    accounts,
    funds,
    accountId,
    fundId,
    ...summarize(before._sum.amountSen ?? 0n, entries),
  };
}
export async function balances() {
  const [accounts, funds, grouped] = await Promise.all([
    db.account.findMany({ orderBy: { code: "asc" } }),
    db.fund.findMany({ orderBy: { code: "asc" } }),
    db.ledgerEntry.groupBy({
      by: ["accountId", "fundId"],
      _sum: { amountSen: true },
    }),
  ]);
  return {
    accounts: accounts.map((a) => ({
      ...a,
      balance: grouped
        .filter((g) => g.accountId === a.id)
        .reduce((s, g) => s + (g._sum.amountSen ?? 0n), 0n),
    })),
    funds: funds.map((f) => ({
      ...f,
      balance: grouped
        .filter((g) => g.fundId === f.id)
        .reduce((s, g) => s + (g._sum.amountSen ?? 0n), 0n),
    })),
  };
}
