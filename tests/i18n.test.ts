import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createTranslator,
  dictionary,
  resolveLanguage,
  translateMessage,
} from "../lib/i18n";

test("missing or unsupported cookie languages fall back to Malay", () => {
  for (const value of [undefined, "", "ms", "en-US", "fr", "__proto__"])
    assert.equal(resolveLanguage(value), "ms");
  assert.equal(resolveLanguage("en"), "en");
});

test("both languages retain every named placeholder and interpolate values literally", () => {
  const placeholders = (text: string) =>
    [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const [key, text] of Object.entries(dictionary)) {
    assert.deepEqual(placeholders(text.ms), placeholders(text.en), key);
    assert.ok(text.ms && text.en, key);
  }
  assert.equal(
    createTranslator("en")("Selamat datang, {name}.", { name: "$& {count}" }),
    "Welcome, $& {count}.",
  );
});

test("controlled flash messages translate without rewriting unknown content", () => {
  assert.equal(
    translateMessage(
      "3 rekod yuran baharu dijana. Rekod sedia ada dikekalkan.",
      "en",
    ),
    "3 new dues records generated. Existing records were retained.",
  );
  assert.equal(
    translateMessage("Dana Kampung Contoh", "en"),
    "Dana Kampung Contoh",
  );
  assert.equal(translateMessage("constructor", "en"), "constructor");
});
