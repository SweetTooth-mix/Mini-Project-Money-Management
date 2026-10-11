type Entry = { amountSen: bigint; type: string };

/** Transfers and opening entries affect balance, but are never reported as income. */
export function summarize(opening: bigint, rows: Entry[]) {
  let income = 0n,
    expense = 0n,
    adjustment = 0n,
    balance = opening;
  const running = rows.map((row) => {
    balance += row.amountSen;
    if (row.type === "INCOME") income += row.amountSen;
    else if (row.type === "EXPENSE") expense -= row.amountSen;
    else adjustment += row.amountSen;
    return balance;
  });
  return { opening, income, expense, adjustment, closing: balance, running };
}

export function csvCell(value: string): string {
  const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
