// Language resolution shared by the server helper and the client provider.
export const languageCookie = "kira-rapi-lang";
export type Language = "ms" | "en";

export function resolveLanguage(value?: string): Language {
  return value === "en" ? "en" : "ms";
}
