import { log } from "./log";
import { createSmtpSender, type MailSender } from "./mail";
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
  email?: { smtpUrl: string; from: string; to: string };
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
  const smtpUrl = env.SMTP_URL;
  const from = env.MAIL_FROM;
  const to = env.APPROVAL_EMAIL_TO;
  return {
    webhookUrl: env.APPROVAL_WEBHOOK_URL || undefined,
    telegramToken: env.APPROVAL_TELEGRAM_TOKEN || undefined,
    telegramChatId: env.APPROVAL_TELEGRAM_CHAT_ID || undefined,
    email: smtpUrl && from && to ? { smtpUrl, from, to } : undefined,
  };
}

export function approvalSubject(notice: ApprovalNotice): string {
  return `Menunggu kelulusan: ${notice.number}`;
}

export function hasApprovalChannel(config: ApprovalNotifierConfig) {
  return Boolean(
    config.webhookUrl ||
    (config.telegramToken && config.telegramChatId) ||
    config.email,
  );
}

export type ApprovalNotifier = {
  configured: boolean;
  notify: (notice: ApprovalNotice) => Promise<void>;
};

type Channel = "webhook" | "telegram" | "email";

export function createApprovalNotifier(
  config: ApprovalNotifierConfig,
  fetchImpl: typeof fetch | null | undefined = globalThis.fetch,
  timeoutMs = 3000,
  mailer: MailSender | null = null,
): ApprovalNotifier {
  const channels: Channel[] = [];
  if (config.webhookUrl) channels.push("webhook");
  // A token without a chat id sends nowhere, so it does not count as configured.
  if (config.telegramToken && config.telegramChatId) channels.push("telegram");
  if (config.email) channels.push("email");
  // Email needs a sender; the other channels need fetch.
  const usable = channels.filter((channel) =>
    channel === "email" ? Boolean(mailer) : Boolean(fetchImpl),
  );

  return {
    configured: usable.length > 0,
    async notify(notice) {
      const text = formatApprovalNotice(notice);
      if (usable.includes("email") && config.email && mailer) {
        try {
          await mailer({
            to: config.email.to,
            subject: approvalSubject(notice),
            text,
          });
        } catch (error) {
          log.warn("approval.notify_failed", {
            channel: "email",
            errName: error instanceof Error ? error.name : "UnknownError",
          });
        }
      }
      if (!fetchImpl) return;
      await Promise.all(
        usable
          .filter((channel) => channel !== "email")
          .map(async (channel) => {
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
  if (!cached) {
    const config = approvalConfigFromEnv();
    cached = createApprovalNotifier(
      config,
      globalThis.fetch,
      3000,
      config.email
        ? createSmtpSender(config.email.smtpUrl, config.email.from)
        : null,
    );
  }
  return cached;
}
