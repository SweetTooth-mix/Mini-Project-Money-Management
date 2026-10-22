import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { getI18n } from "@/lib/i18n-server";
import { LanguageProvider } from "@/components/language-provider";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: {
      default: t("Kira Rapi — Kewangan Komuniti"),
      template: "%s · Kira Rapi",
    },
    description: t(
      "Urus buku tunai, resit, baucer dan yuran komuniti dengan lebih rapi.",
    ),
    robots: { index: false, follow: false },
  };
}
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { language, t } = await getI18n();
  // Set by proxy.ts; Next also stamps this nonce on its own scripts.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang={language} suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){var t;try{t=localStorage.getItem('kira-rapi-theme')}catch(e){}document.documentElement.dataset.theme=t==='light'||t==='dark'?t:window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'})()`,
          }}
        />
      </head>
      <body>
        <LanguageProvider language={language}>
          <a className="skip-link" href="#main-content">
            {t("Langkau ke kandungan")}
          </a>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
