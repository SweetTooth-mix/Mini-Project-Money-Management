import { log } from "./log";
import { money } from "./money";

// Reviewers hear about a document the moment it is submitted, without a mail
// server: the Telegram Bot API and a plain JSON webhook each accept one HTTP
// POST. Both channels are optional; with neither configured this is a no-op.

export type ApprovalNotice = {
  id: string;
  number: string;
  type: "BAUCER" | "RESIT";
  party: string;
  description: string;
  amountSen: bigint;
  submittedBy: string;
  url: string;
};

export type ApprovalNotifierConfig = {
  webhookUrl?: string;
  telegramToken?: string;
  telegramChatId?: string;
};

const typeNames = { BAUCER: "Baucer", RESIT: "Resit" } as const;

// Operational text for reviewers, not UI copy: notifications, like the printed
// documents and reports, stay in Malay.
export function formatApprovalNotice(notice: ApprovalNotice): string {
  return [
    "Dokumen menunggu kelulusan",
    `${notice.number} (${typeNames[notice.type]})`,
    `Pihak: ${notice.party}`,
    `Butiran: ${notice.description}`,
    `Amaun: ${money(notice.amountSen)}`,
    `Dihantar oleh: ${notice.submittedBy}`,
    notice.url ? `Semak: ${notice.url}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function approvalConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): ApprovalNotifierConfig {
  return {
    webhookUrl: env.APPROVAL_WEBHOOK_URL || undefined,
    telegramToken: env.APPROVAL_TELEGRAM_TOKEN || undefined,
    telegramChatId: env.APPROVAL_TELEGRAM_CHAT_ID || undefined,
  };
}

export function hasApprovalChannel(config: ApprovalNotifierConfig) {
  return Boolean(
    config.webhookUrl || (config.telegramToken && config.telegramChatId),
  );
}

export type ApprovalNotifier = {
  configured: boolean;
  notify: (notice: ApprovalNotice) => Promise<void>;
};

type Channel = "webhook" | "telegram";

export function createApprovalNotifier(
  config: ApprovalNotifierConfig,
  fetchImpl: typeof fetch | null | undefined = globalThis.fetch,
  timeoutMs = 3000,
): ApprovalNotifier {
  const channels: Channel[] = [];
  if (config.webhookUrl) channels.push("webhook");
  // A token without a chat id sends nowhere, so it does not count as configured.
  if (config.telegramToken && config.telegramChatId) channels.push("telegram");
  const usable = fetchImpl ? channels : [];

  return {
    configured: usable.length > 0,
    async notify(notice) {
      if (!fetchImpl) return;
      const text = formatApprovalNotice(notice);
      await Promise.all(
        usable.map(async (channel) => {
          const url =
            channel === "telegram"
              ? `https://api.telegram.org/bot${config.telegramToken}/sendMessage`
              : (config.webhookUrl as string);
          const body =
            channel === "telegram"
              ? {
                  chat_id: config.telegramChatId,
                  text,
                  disable_web_page_preview: true,
                }
              : { ...notice, amountSen: notice.amountSen.toString(), text };
          try {
            const response = await fetchImpl(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
              signal: AbortSignal.timeout(timeoutMs),
            });
            if (!response.ok)
              log.warn("approval.notify_failed", {
                channel,
                status: response.status,
              });
          } catch (error) {
            // A reviewer missing a ping must never fail the submission itself.
            log.warn("approval.notify_failed", {
              channel,
              errName: error instanceof Error ? error.name : "UnknownError",
            });
          }
        }),
      );
    },
  };
}

let cached: ApprovalNotifier | undefined;
export function getApprovalNotifier() {
  cached ??= createApprovalNotifier(approvalConfigFromEnv());
  return cached;
}
