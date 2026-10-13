"use client";

import { createContext, useContext, useMemo } from "react";
import { createTranslator, type Language } from "@/lib/i18n";

const LanguageContext = createContext<Language>("ms");

export function LanguageProvider({
  language,
  children,
}: {
  language: Language;
  children: React.ReactNode;
}) {
  return (
    <LanguageContext.Provider value={language}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useI18n() {
  const language = useContext(LanguageContext);
  return useMemo(
    () => ({ language, t: createTranslator(language) }),
    [language],
  );
}
