import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Kira Rapi — Kewangan Komuniti",
    template: "%s · Kira Rapi",
  },
  description:
    "Urus buku tunai, resit, baucer dan yuran komuniti dengan lebih rapi.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ms" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t;try{t=localStorage.getItem('kira-rapi-theme')}catch(e){}document.documentElement.dataset.theme=t==='light'||t==='dark'?t:window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'})()`,
          }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Langkau ke kandungan
        </a>
        {children}
      </body>
    </html>
  );
}
