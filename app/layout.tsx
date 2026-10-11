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
    <html lang="ms">
      <body>
        <a className="skip-link" href="#main-content">
          Langkau ke kandungan
        </a>
        {children}
      </body>
    </html>
  );
}
