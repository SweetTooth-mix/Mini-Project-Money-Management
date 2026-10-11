import Link from "next/link";
import { registerAction } from "@/app/actions";
import { Brand } from "@/components/shell";
import { Field, Flash } from "@/components/ui";
import { Submit } from "@/components/form-controls";
import type { Search } from "@/lib/queries";
export default async function Register({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  return (
    <main className="register-page" id="main-content">
      <Link href="/login">
        <Brand />
      </Link>
      <section className="register-card">
        <p className="eyebrow">SERTAI RUANG KERJA</p>
        <h1>Mohon akses.</h1>
        <p className="muted">
          Pentadbir akan menyemak permohonan sebelum akaun anda diaktifkan.
        </p>
        <Flash search={await searchParams} />
        <form action={registerAction}>
          <Field label="Nama penuh">
            <input name="name" autoComplete="name" maxLength={100} required />
          </Field>
          <Field label="Alamat e-mel">
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={200}
              required
            />
          </Field>
          <Field label="Kata laluan" hint="Gunakan 12–72 aksara.">
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={72}
              required
            />
          </Field>
          <Submit>Hantar permohonan</Submit>
        </form>
        <Link href="/login" className="back-link">
          ← Kembali ke log masuk
        </Link>
      </section>
    </main>
  );
}
