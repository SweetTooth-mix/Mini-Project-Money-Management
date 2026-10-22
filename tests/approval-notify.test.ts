import { test } from "node:test";
import assert from "node:assert/strict";
import {
  approvalConfigFromEnv,
  approvalSubject,
  createApprovalNotifier,
  formatApprovalNotice,
  hasApprovalChannel,
} from "../lib/approval-notify";
import type { MailMessage } from "../lib/mail";

const notice = {
  id: "doc_1",
  number: "RS-2026-00012",
  type: "RESIT" as const,
  party: "Pejabat Daerah",
  description: "Peruntukan pengurusan kampung",
  amountSen: 850000n,
  submittedBy: "Siti Aminah",
  url: "https://kira.example/dashboard/baucer-resit/doc_1",
};

test("the review message carries every field a reviewer needs to decide", () => {
  const text = formatApprovalNotice(notice);
  assert.match(text, /^Dokumen menunggu kelulusan/);
  assert.match(text, /RS-2026-00012 \(Resit\)/);
  assert.match(text, /Pihak: Pejabat Daerah/);
  assert.match(text, /Amaun: RM 8,500\.00/);
  assert.match(text, /Dihantar oleh: Siti Aminah/);
  assert.match(
    text,
    /Semak: https:\/\/kira\.example\/dashboard\/baucer-resit\/doc_1/,
  );
});

test("a notice without a link omits the line instead of leaving it empty", () => {
  const text = formatApprovalNotice({ ...notice, url: "" });
  assert.doesNotMatch(text, /Semak:/);
  assert.equal(text.split("\n").filter(Boolean).length, 6);
});

test("no configured channel means no network call", async () => {
  let calls = 0;
  const notifier = createApprovalNotifier({}, (async () => {
    calls += 1;
    return new Response("{}");
  }) as typeof fetch);

  assert.equal(notifier.configured, false);
  await notifier.notify(notice);
  assert.equal(calls, 0);
});

test("a Telegram token without a chat id is not treated as configured", () => {
  const config = { telegramToken: "123:abc" };
  assert.equal(hasApprovalChannel(config), false);
  assert.equal(createApprovalNotifier(config).configured, false);
});

test("the webhook receives the document plus the rendered text", async () => {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const notifier = createApprovalNotifier(
    { webhookUrl: "https://hooks.example/kira" },
    (async (url: string, init: RequestInit) => {
      requests.push({
        url,
        body: JSON.parse(String(init.body)) as Record<string, unknown>,
      });
      return new Response("{}");
    }) as unknown as typeof fetch,
  );

  assert.equal(notifier.configured, true);
  await notifier.notify(notice);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://hooks.example/kira");
  assert.equal(requests[0].body.number, "RS-2026-00012");
  // bigint cannot survive JSON, so it travels as a string alongside the text.
  assert.equal(requests[0].body.amountSen, "850000");
  assert.match(String(requests[0].body.text), /RM 8,500\.00/);
});

test("Telegram is called with the bot URL, chat id and no link preview", async () => {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const notifier = createApprovalNotifier(
    { telegramToken: "123:abc", telegramChatId: "-100200" },
    (async (url: string, init: RequestInit) => {
      requests.push({
        url,
        body: JSON.parse(String(init.body)) as Record<string, unknown>,
      });
      return new Response("{}");
    }) as unknown as typeof fetch,
  );

  await notifier.notify(notice);
  assert.equal(
    requests[0].url,
    "https://api.telegram.org/bot123:abc/sendMessage",
  );
  assert.equal(requests[0].body.chat_id, "-100200");
  assert.equal(requests[0].body.disable_web_page_preview, true);
});

test("both channels are used when both are configured", async () => {
  const urls: string[] = [];
  const notifier = createApprovalNotifier(
    {
      webhookUrl: "https://hooks.example/kira",
      telegramToken: "123:abc",
      telegramChatId: "-100200",
    },
    (async (url: string) => {
      urls.push(url);
      return new Response("{}");
    }) as unknown as typeof fetch,
  );

  await notifier.notify(notice);
  assert.deepEqual(urls.sort(), [
    "https://api.telegram.org/bot123:abc/sendMessage",
    "https://hooks.example/kira",
  ]);
});

test("a failing channel never throws into the submission", async () => {
  const notifier = createApprovalNotifier(
    { webhookUrl: "https://hooks.example/kira" },
    (async () => {
      throw new TypeError("network down");
    }) as unknown as typeof fetch,
  );
  await assert.doesNotReject(() => notifier.notify(notice));
});

test("an error response is not treated as delivered, but is swallowed", async () => {
  const notifier = createApprovalNotifier(
    { webhookUrl: "https://hooks.example/kira" },
    (async () =>
      new Response("nope", { status: 500 })) as unknown as typeof fetch,
  );
  await assert.doesNotReject(() => notifier.notify(notice));
});

test("environment configuration ignores blank values", () => {
  assert.deepEqual(approvalConfigFromEnv({}), {
    webhookUrl: undefined,
    telegramToken: undefined,
    telegramChatId: undefined,
    email: undefined,
  });
  assert.deepEqual(
    approvalConfigFromEnv({
      APPROVAL_WEBHOOK_URL: "",
      APPROVAL_TELEGRAM_TOKEN: "123:abc",
      APPROVAL_TELEGRAM_CHAT_ID: "-100200",
    }),
    {
      webhookUrl: undefined,
      telegramToken: "123:abc",
      telegramChatId: "-100200",
      email: undefined,
    },
  );
});

test("email is delivered with a subject and the same Malay body", async () => {
  const sent: MailMessage[] = [];
  const notifier = createApprovalNotifier(
    {
      email: {
        smtpUrl: "smtp://user:secret@smtp.example:587",
        from: "kira@example.test",
        to: "bendahari@example.test",
      },
    },
    null,
    3000,
    async (message) => {
      sent.push(message);
    },
  );

  // No fetch available at all: email must still count as a usable channel.
  assert.equal(notifier.configured, true);
  await notifier.notify(notice);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "bendahari@example.test");
  assert.equal(sent[0].subject, approvalSubject(notice));
  assert.match(sent[0].subject, /RS-2026-00012/);
  assert.match(sent[0].text, /Amaun: RM 8,500\.00/);
});

test("an email config without a sender is not treated as configured", () => {
  const notifier = createApprovalNotifier({
    email: { smtpUrl: "smtp://x", from: "a@b", to: "c@d" },
  });
  assert.equal(notifier.configured, false);
  assert.equal(
    hasApprovalChannel({
      email: { smtpUrl: "smtp://x", from: "a@b", to: "c@d" },
    }),
    true,
  );
});

test("a failing mail server never throws into the submission", async () => {
  const notifier = createApprovalNotifier(
    { email: { smtpUrl: "smtp://x", from: "a@b", to: "c@d" } },
    null,
    3000,
    async () => {
      throw new Error("connection refused");
    },
  );
  await assert.doesNotReject(() => notifier.notify(notice));
});

test("email settings are only used when all three values are present", () => {
  assert.equal(
    approvalConfigFromEnv({ SMTP_URL: "smtp://x", MAIL_FROM: "a@b" }).email,
    undefined,
  );
  assert.deepEqual(
    approvalConfigFromEnv({
      SMTP_URL: "smtp://x",
      MAIL_FROM: "a@b",
      APPROVAL_EMAIL_TO: "c@d",
    }).email,
    { smtpUrl: "smtp://x", from: "a@b", to: "c@d" },
  );
});

test("email and webhook are delivered independently", async () => {
  const sent: MailMessage[] = [];
  const urls: string[] = [];
  const notifier = createApprovalNotifier(
    {
      webhookUrl: "https://hooks.example/kira",
      email: { smtpUrl: "smtp://x", from: "a@b", to: "c@d" },
    },
    (async (url: string) => {
      urls.push(url);
      return new Response("{}");
    }) as unknown as typeof fetch,
    3000,
    async (message) => {
      sent.push(message);
    },
  );

  await notifier.notify(notice);
  assert.equal(sent.length, 1);
  assert.deepEqual(urls, ["https://hooks.example/kira"]);
});
