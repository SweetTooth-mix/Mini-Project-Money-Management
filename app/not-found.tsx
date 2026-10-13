import { getI18n } from "@/lib/i18n-server";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
export default async function NotFound() {
  const { t } = await getI18n();

  return (
    <main className="empty-state" id="main-content">
      <div className="auth-theme">
        <ThemeToggle />
        <LanguageToggle />
      </div>
      <h1>{t("Rekod tidak dijumpai.")}</h1>
      <p>{t("Pautan mungkin tidak tepat atau rekod tidak tersedia.")}</p>
      <Link href="/dashboard" className="button button-primary">
        {t("Kembali ke dashboard")}
      </Link>
    </main>
  );
}
