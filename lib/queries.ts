import { db } from "./db";
import { param, type Search } from "./search";
import { monthRange } from "./money";
import { summarize } from "./ledger";

export type { Search } from "./search";
export { param } from "./search";

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

/** Paginate the cash book view after calculating balances over the full period. */
export async function ledgerPageData(search: Search) {
  const data = await ledgerData(search);
  const query = param(search, "q").trim().slice(0, 200);
  const needle = query.toLowerCase();
  const matches = data.entries
    .map((entry, index) => ({ entry, balance: data.running[index] }))
    .filter(
      ({ entry }) =>
        !needle ||
        [entry.description, entry.reference, entry.category].some((value) =>
          value.toLowerCase().includes(needle),
        ),
    );
  const count = matches.length;
  const pages = Math.max(1, Math.ceil(count / 50));
  const page = Math.max(
    1,
    Math.min(pages, Number.parseInt(param(search, "page")) || 1),
  );
  const visible = matches.slice((page - 1) * 50, page * 50);
  return {
    ...data,
    query,
    count,
    pages,
    page,
    entries: visible.map(({ entry }) => entry),
    running: visible.map(({ balance }) => balance),
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
