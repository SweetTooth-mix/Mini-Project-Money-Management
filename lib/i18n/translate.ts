import {
  dictionary,
  type TranslationKey,
  type TranslationParams,
} from "./dictionary";
import type { Language } from "./language";

export function createTranslator(language: Language) {
  return (key: TranslationKey, params: TranslationParams = {}) =>
    dictionary[key][language].replace(/\{(\w+)\}/g, (match, name: string) =>
      Object.hasOwn(params, name) ? String(params[name]) : match,
    );
}

// Only use for controlled UI messages, never for stored financial/user content.
export function translateMessage(message: string, language: Language): string {
  if (Object.hasOwn(dictionary, message))
    return dictionary[message as TranslationKey][language];
  const dues =
    /^(\d+) rekod yuran baharu dijana\. Rekod sedia ada dikekalkan\.$/.exec(
      message,
    );
  if (dues)
    return createTranslator(language)(
      "{count} rekod yuran baharu dijana. Rekod sedia ada dikekalkan.",
      { count: dues[1] },
    );
  return message;
}
