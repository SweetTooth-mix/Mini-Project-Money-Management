// Merged UI dictionary. Malay source phrases are stable dictionary keys, so
// moving a phrase between groups changes the file layout but never the lookup.
// Report generators and printable documents stay in Malay and are not here.
import { commonMessages } from "./messages/common";
import { authMessages } from "./messages/auth";
import { documentsMessages } from "./messages/documents";
import { cashbookMessages } from "./messages/cashbook";
import { reportsMessages } from "./messages/reports";
import { auditMessages } from "./messages/audit";
import { settingsMessages } from "./messages/settings";

export const dictionary = {
  ...commonMessages,
  ...authMessages,
  ...documentsMessages,
  ...cashbookMessages,
  ...reportsMessages,
  ...auditMessages,
  ...settingsMessages,
} as const;

export type TranslationKey = keyof typeof dictionary;
export type TranslationParams = Record<string, string | number>;
