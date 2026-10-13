import { getI18n } from "@/lib/i18n-server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { loginAction } from "@/app/actions";
import { Brand } from "@/components/shell";
import { Field, Flash } from "@/components/ui";
import { Submit } from "@/components/form-controls";
import type { Search } from "@/lib/queries";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { t } = await getI18n();

  if (await currentUser()) redirect("/dashboard");
  return (
    <main className="auth-layout" id="main-content">
      <section className="auth-story">
        <Brand />
        <div className="auth-story-content">
          <span className="auth-tag">
            <i /> {t("UNTUK KOMUNITI, BERSAMA KOMUNITI")}
          </span>
          <h1>
            {t("Kewangan teratur.")}
            <br />
            <em>{t("Komuniti makmur.")}</em>
          </h1>
          <p>
            {t(
              "Satu ruang untuk setiap rekod, setiap urusan, dan setiap sen yang diamanahkan.",
            )}
          </p>
          <div className="auth-preview">
            <div className="preview-title">
              <span>{t("Lebih jelas. Lebih yakin.")}</span>
              <ShieldCheck size={21} />
            </div>
            {[
              t("Buku tunai yang sentiasa seimbang"),
              t("Resit dan baucer dengan jejak kelulusan"),
              t("Rumusan kewangan sedia dicetak"),
            ].map((t) => (
              <div className="preview-line" key={t}>
                <span>
                  <Check size={15} />
                </span>
                {t}
              </div>
            ))}
          </div>
        </div>
        <p className="auth-copyright">
          {t("Kira Rapi · Urus kewangan dengan lebih rapi.")}
        </p>
        <div className="auth-orbit" />
      </section>
      <section className="auth-form-side">
        <div className="auth-theme">
          <ThemeToggle />
          <LanguageToggle />
        </div>
        <div className="auth-form">
          <span className="eyebrow">{t("SELAMAT KEMBALI")}</span>
          <h2>{t("Masuk ke ruang kerja.")}</h2>
          <p className="muted">
            {t("Teruskan mengurus kewangan komuniti anda.")}
          </p>
          <Flash search={await searchParams} />
          <form action={loginAction}>
            <Field label={t("Alamat e-mel")}>
              <input
                type="email"
                name="email"
                autoComplete="username"
                placeholder={t("nama@organisasi.my")}
                maxLength={200}
                required
              />
            </Field>
            <Field label={t("Kata laluan")}>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder={t("Masukkan kata laluan")}
                maxLength={72}
                required
              />
            </Field>
            <Submit>
              {t("Log masuk")} <ArrowRight size={17} />
            </Submit>
          </form>
          <p className="auth-bottom">
            {t("Belum mempunyai akaun?")}{" "}
            <Link href="/register">{t("Mohon akses")}</Link>
          </p>
          <div className="auth-security">
            <ShieldCheck size={15} />
            {t("Akses terlindung · Sesi 8 jam")}
          </div>
        </div>
      </section>
    </main>
  );
}
