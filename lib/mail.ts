import type { Transporter } from "nodemailer";

// SMTP delivery, kept behind a one-function interface so callers can be tested
// without a mail server and so nodemailer is only pulled in when email is
// actually configured.
export type MailMessage = { to: string; subject: string; text: string };
export type MailSender = (message: MailMessage) => Promise<void>;

export function createSmtpSender(smtpUrl: string, from: string): MailSender {
  let transport: Transporter | undefined;
  return async ({ to, subject, text }) => {
    // Lazy: deployments that use Telegram or a webhook never load nodemailer.
    const nodemailer = await import("nodemailer");
    transport ??= nodemailer.createTransport(smtpUrl);
    await transport.sendMail({ from, to, subject, text });
  };
}
