import { getI18n } from "@/lib/i18n-server";
import Link from "next/link";
import { registerAction } from "@/app/actions";
import { Brand } from "@/components/shell";
import { Field, Flash } from "@/components/ui";
import { Submit } from "@/components/form-controls";
import type { Search } from "@/lib/queries";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
export default async function Register({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { t } = await getI18n();

  return (
    <main className="register-page" id="main-content">
      <div className="auth-theme">
        <ThemeToggle />
        <LanguageToggle />
      </div>
      <Link href="/login">
        <Brand />
      </Link>
      <section className="register-card">
        <p className="eyebrow">{t("SERTAI RUANG KERJA")}</p>
        <h1>{t("Mohon akses.")}</h1>
        <p className="muted">
          {t(
            "Pentadbir akan menyemak permohonan sebelum akaun anda diaktifkan.",
          )}
        </p>
        <Flash search={await searchParams} />
        <form action={registerAction}>
          <Field label={t("Nama penuh")}>
            <input name="name" autoComplete="name" maxLength={100} required />
          </Field>
          <Field label={t("Alamat e-mel")}>
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={200}
              required
            />
          </Field>
          <Field label={t("Kata laluan")} hint={t("Gunakan 12–72 aksara.")}>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={72}
              required
            />
          </Field>
          <Submit>{t("Hantar permohonan")}</Submit>
        </form>
        <Link href="/login" className="back-link">
          {t("← Kembali ke log masuk")}
        </Link>
      </section>
    </main>
  );
}
