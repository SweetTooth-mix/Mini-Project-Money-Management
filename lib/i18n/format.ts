import type { Language } from "./language";

// Dates are formatted in the UI locale but always resolved in UTC, so a booking
// never shifts a day across the Malaysia time zone.
export function uiLocale(language: Language) {
  return language === "en" ? "en-GB" : "ms-MY";
}
export function uiDate(date: Date, language: Language) {
  return new Intl.DateTimeFormat(uiLocale(language), {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
export function uiMonth(month: string, language: Language) {
  return new Intl.DateTimeFormat(uiLocale(language), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}
export function uiMonthName(index: number, language: Language, short = false) {
  return new Intl.DateTimeFormat(uiLocale(language), {
    month: short ? "short" : "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2020, index, 1)));
}
