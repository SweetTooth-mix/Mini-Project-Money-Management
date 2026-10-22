// UI translations only. Report generators and printable documents stay in Malay.
//
// The dictionary is grouped by screen area under lib/i18n/messages; the keys are
// the Malay source phrases, so a phrase can move between groups without changing
// its lookup. Everything else is re-exported here so call sites keep importing
// from "@/lib/i18n".
export * from "./i18n/language";
export * from "./i18n/dictionary";
export * from "./i18n/translate";
export * from "./i18n/format";
