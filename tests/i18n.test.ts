import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createTranslator,
  dictionary,
  resolveLanguage,
  translateMessage,
} from "../lib/i18n";
import { auditMessages } from "../lib/i18n/messages/audit";
import { authMessages } from "../lib/i18n/messages/auth";
import { cashbookMessages } from "../lib/i18n/messages/cashbook";
import { commonMessages } from "../lib/i18n/messages/common";
import { documentsMessages } from "../lib/i18n/messages/documents";
import { reportsMessages } from "../lib/i18n/messages/reports";
import { settingsMessages } from "../lib/i18n/messages/settings";

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

test("no message key is defined in two groups", () => {
  // The groups are merged with object spread, which silently drops a duplicate,
  // so a copy-pasted phrase could otherwise lose its translation.
  const groups = {
    commonMessages,
    authMessages,
    documentsMessages,
    cashbookMessages,
    reportsMessages,
    auditMessages,
    settingsMessages,
  };
  const seen = new Map<string, string>();
  for (const [group, messages] of Object.entries(groups))
    for (const key of Object.keys(messages)) {
      assert.equal(
        seen.has(key),
        false,
        `"${key}" is defined in ${seen.get(key)} and ${group}`,
      );
      seen.set(key, group);
    }
  assert.equal(Object.keys(dictionary).length, seen.size);
});
