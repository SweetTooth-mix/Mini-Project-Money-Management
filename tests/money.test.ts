import { test } from "node:test";
import assert from "node:assert/strict";
import { dateOnly, money, parseMoney, terbilang } from "../lib/money";

test("ringgit are parsed in exact integer sen without floating point drift", () => {
  assert.equal(parseMoney("0.10") + parseMoney("0.20"), 30n);
  assert.equal(parseMoney("9999999999.99"), 999999999999n);
  assert.equal(parseMoney("12.5"), 1250n);
  assert.equal(parseMoney("0"), 0n);
});
test("reject negative, exponent, precision and overflow inputs", () => {
  for (const input of [
    "-1",
    "1e5",
    "1.001",
    "NaN",
    "Infinity",
    "",
    "1,000",
    "10000000000",
    "1.2.3",
  ])
    assert.throws(() => parseMoney(input));
});
test("format large and negative balances exactly", () => {
  assert.equal(money(123456n), "RM 1,234.56");
  assert.equal(money(-1n), "−RM 0.01");
  assert.equal(money(900719925474099301n), "RM 9,007,199,254,740,993.01");
});
test("Malay amount words include sen and special hundred/thousand cases", () => {
  assert.equal(
    terbilang(120050n),
    "seribu dua ratus ringgit Malaysia dan lima puluh sen sahaja",
  );
  assert.equal(
    terbilang(11111n),
    "seratus sebelas ringgit Malaysia dan sebelas sen sahaja",
  );
  assert.equal(terbilang(0n), "kosong ringgit Malaysia sahaja");
  assert.equal(
    terbilang(200000000100n),
    "dua bilion satu ringgit Malaysia sahaja",
  );
});
test("financial dates reject calendar rollover and timestamps", () => {
  assert.equal(
    dateOnly("2024-02-29").toISOString(),
    "2024-02-29T00:00:00.000Z",
  );
  for (const input of [
    "2025-02-29",
    "2026-04-31",
    "2026-13-01",
    "2026-01-01T12:00:00Z",
  ])
    assert.throws(() => dateOnly(input));
});
