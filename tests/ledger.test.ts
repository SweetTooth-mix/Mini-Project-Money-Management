import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, summarize } from "../lib/ledger";

test("opening + income - expense + adjustments reconciles exactly to closing", () => {
  const result = summarize(10000n, [
    { type: "INCOME", amountSen: 1005n },
    { type: "EXPENSE", amountSen: -405n },
    { type: "TRANSFER_OUT", amountSen: -2000n },
    { type: "TRANSFER_IN", amountSen: 2000n },
    { type: "REVERSAL", amountSen: 405n },
  ]);
  assert.deepEqual(result, {
    opening: 10000n,
    income: 1005n,
    expense: 405n,
    adjustment: 405n,
    closing: 11005n,
    running: [11005n, 10600n, 8600n, 10600n, 11005n],
  });
});
test("filtered account transfers affect balance without inflating income", () => {
  assert.deepEqual(
    summarize(1000n, [{ type: "TRANSFER_IN", amountSen: 500n }]),
    {
      opening: 1000n,
      income: 0n,
      expense: 0n,
      adjustment: 500n,
      closing: 1500n,
      running: [1500n],
    },
  );
});
test("CSV escapes quotes, line breaks and spreadsheet formula prefixes", () => {
  assert.equal(csvCell('Ali, "Ahmad"\nBaris'), '"Ali, ""Ahmad""\nBaris"');
  for (const value of ["=1+2", "+SUM(A1)", "-1+1", "@test", " =cmd", "\t=cmd"])
    assert.ok(csvCell(value).startsWith("\"'"));
});
