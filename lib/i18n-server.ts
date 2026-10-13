import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createTranslator, languageCookie, resolveLanguage } from "./i18n";

export const getLanguage = cache(async () =>
  resolveLanguage((await cookies()).get(languageCookie)?.value),
);

export async function getI18n() {
  const language = await getLanguage();
  return { language, t: createTranslator(language) };
}
