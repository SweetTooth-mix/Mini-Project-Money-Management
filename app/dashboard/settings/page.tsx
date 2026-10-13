import { uiDate } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  closePeriodAction,
  createUserAction,
  organizationAction,
  passwordAction,
  userStatusAction,
} from "@/app/actions";
import { Field, Flash, PageHeading, Panel, Status } from "@/components/ui";
import { Submit } from "@/components/form-controls";
import { today } from "@/lib/money";
import type { Search } from "@/lib/queries";

export default async function Settings({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { t, language } = await getI18n();

  const user = await requireUser();
  const org = await db.organization.findUniqueOrThrow({
    where: { id: "main" },
  });
  const users =
    user.role === "SUPER_ADMIN"
      ? await db.user.findMany({
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : [];
  return (
    <>
      <PageHeading
        title={t("Tetapan ruang kerja")}
        description={t(
          "Urus profil organisasi, akses pengguna dan kawalan kewangan.",
        )}
      />
      <Flash search={await searchParams} />
      {user.role === "SUPER_ADMIN" && (
        <>
          <Panel
            title={t("Profil & template organisasi")}
            description={t(
              "Maklumat ini digunakan pada cetakan. Dokumen yang telah diluluskan mengekalkan maklumat ketika kelulusan.",
            )}
          >
            <form action={organizationAction} className="form-grid">
              <Field label={t("Nama organisasi")} wide>
                <input
                  name="name"
                  defaultValue={org.name}
                  maxLength={150}
                  required
                />
              </Field>
              <Field label={t("Alamat")} wide>
                <textarea
                  name="address"
                  defaultValue={org.address}
                  maxLength={300}
                  rows={2}
                />
              </Field>
              <Field label={t("E-mel")}>
                <input
                  name="email"
                  type="email"
                  defaultValue={org.email}
                  maxLength={150}
                />
              </Field>
              <Field label={t("Telefon")}>
                <input name="phone" defaultValue={org.phone} maxLength={30} />
              </Field>
              <Field label={t("Jawatan penyedia")}>
                <input
                  name="preparedBy"
                  defaultValue={org.preparedBy}
                  maxLength={100}
                />
              </Field>
              <Field label={t("Jawatan pemeriksa")}>
                <input
                  name="checkedBy"
                  defaultValue={org.checkedBy}
                  maxLength={100}
                />
              </Field>
              <Field label={t("Nama / jawatan pengesahan")}>
                <input
                  name="approvedBy"
                  defaultValue={org.approvedBy}
                  maxLength={100}
                />
              </Field>
              <div className="form-footer field-wide">
                <Submit>{t("Simpan profil organisasi")}</Submit>
              </div>
            </form>
          </Panel>
          <div className="two-column-forms">
            <Panel
              title={t("Kunci tempoh kewangan")}
              description={t(
                "Halang catatan dan pindahan baharu dalam tempoh yang telah ditutup.",
              )}
            >
              <form action={closePeriodAction} className="form-grid">
                <div className="info-note field-wide">
                  {org.closedThrough
                    ? t("Tempoh dikunci sehingga {date}.", {
                        date: uiDate(org.closedThrough, language),
                      })
                    : t("Tiada tempoh dikunci.")}
                </div>
                <Field
                  label={t("Kunci sehingga tarikh")}
                  wide
                  hint={t(
                    "Kosongkan medan untuk membuka semula tempoh. Perubahan direkod dalam audit.",
                  )}
                >
                  <input
                    name="date"
                    type="date"
                    defaultValue={org.closedThrough?.toISOString().slice(0, 10)}
                    max={today()}
                  />
                </Field>
                <div className="form-footer field-wide">
                  <Submit>{t("Simpan kawalan tempoh")}</Submit>
                </div>
              </form>
            </Panel>
            <Panel
              title={t("Cipta akaun pengguna")}
              description={t(
                "Sediakan pentadbir lain untuk menyemak dan meluluskan dokumen.",
              )}
            >
              <form action={createUserAction} className="form-grid">
                <Field label={t("Nama")}>
                  <input name="name" maxLength={100} required />
                </Field>
                <Field label={t("E-mel")}>
                  <input name="email" type="email" maxLength={200} required />
                </Field>
                <Field label={t("Peranan")}>
                  <select name="role" defaultValue="USER">
                    <option value="USER">
                      {t("Pengguna — lihat & sediakan draf")}
                    </option>
                    <option value="ADMIN">
                      {t("Pentadbir — kelulusan & bayaran")}
                    </option>
                    <option value="SUPER_ADMIN">
                      {t("Super Admin — semua tetapan")}
                    </option>
                  </select>
                </Field>
                <Field label={t("Kata laluan awal")}>
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={72}
                    required
                  />
                </Field>
                <div className="form-footer field-wide">
                  <Submit>{t("Cipta pengguna")}</Submit>
                </div>
              </form>
            </Panel>
          </div>
          <Panel
            title={t("Akses pengguna")}
            description={t(
              "Permohonan baharu perlu diaktifkan. Menyahaktifkan pengguna turut menamatkan sesinya.",
            )}
          >
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t("Pengguna")}</th>
                    <th>{t("Peranan")}</th>
                    <th>{t("Status")}</th>
                    <th>{t("Tindakan")}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <strong className="table-primary">
                          {u.name}
                          {u.id === user.id ? t(" (anda)") : ""}
                        </strong>
                        <small className="table-sub">{u.email}</small>
                      </td>
                      <td>
                        {
                          {
                            SUPER_ADMIN: t("Super Admin"),
                            ADMIN: t("Pentadbir"),
                            USER: t("Pengguna"),
                          }[u.role]
                        }
                      </td>
                      <td>
                        <Status value={u.status} />
                      </td>
                      <td>
                        {u.id !== user.id && (
                          <form action={userStatusAction}>
                            <input type="hidden" name="id" value={u.id} />
                            <input
                              type="hidden"
                              name="status"
                              value={
                                u.status === "ACTIVE" ? "DISABLED" : "ACTIVE"
                              }
                            />
                            <Submit className="button button-small button-secondary">
                              {u.status === "ACTIVE"
                                ? t("Nyahaktif")
                                : t("Aktifkan")}
                            </Submit>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
      <Panel
        title={t("Kata laluan anda")}
        description={t(
          "Menukar kata laluan akan menamatkan sesi terdahulu pada peranti lain.",
        )}
      >
        <form action={passwordAction} className="form-grid">
          <Field label={t("Kata laluan semasa")}>
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              maxLength={72}
              required
            />
          </Field>
          <Field label={t("Kata laluan baharu")} hint={t("Minimum 12 aksara.")}>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={72}
              required
            />
          </Field>
          <div className="form-footer field-wide">
            <Submit>{t("Tukar kata laluan")}</Submit>
          </div>
        </form>
      </Panel>
    </>
  );
}
