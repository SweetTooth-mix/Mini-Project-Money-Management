"use server";

import { cookies } from "next/headers";
import { languageCookie, type Language } from "@/lib/i18n";

export async function setLanguage(language: Language) {
  if (language !== "ms" && language !== "en") {
    throw new Error("Unsupported language.");
  }
  (await cookies()).set(languageCookie, language, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.APP_URL?.startsWith("https://") ?? false,
  });
}
