import { Landmark, Plus, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { balances, type Search } from "@/lib/queries";
import { money, today } from "@/lib/money";
import { createAccountAction, createFundAction } from "@/app/actions";
import { Field, Flash, PageHeading, Panel } from "@/components/ui";
import { Submit } from "@/components/form-controls";

export default async function Accounts({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await requireUser(),
    data = await balances();
  return (
    <>
      <PageHeading
        title="Akaun & dana"
        description="Asingkan tempat wang disimpan dan tujuan wang digunakan."
      />
      <Flash search={await searchParams} />
      <div className="account-grid">
        {data.accounts.map((a) => (
          <section className="account-card" key={a.id}>
            <div className="account-card-top">
              <span className="account-icon">
                {a.type === "BANK" ? (
                  <Landmark size={23} />
                ) : (
                  <Wallet size={23} />
                )}
              </span>
              <span className="subtle-tag">
                {{ BANK: "Bank", CASH: "Tunai", OTHER: "Lain-lain" }[a.type]}
              </span>
            </div>
            <p>{a.code}</p>
            <h2>{a.name}</h2>
            <strong className={a.balance < 0n ? "text-red" : ""}>
              {money(a.balance)}
            </strong>
            <small>Baki semasa daripada buku tunai</small>
          </section>
        ))}
      </div>
      <Panel
        title="Dana organisasi"
        description="Dana ialah tujuan peruntukan. Satu akaun boleh menyimpan wang daripada beberapa dana."
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Dana</th>
                <th>Kod</th>
                <th className="align-right">Baki semasa</th>
              </tr>
            </thead>
            <tbody>
              {data.funds.map((f) => (
                <tr key={f.id}>
                  <td>
                    <span className="fund-label">
                      <i style={{ background: f.color }} />
                      {f.name}
                    </span>
                  </td>
                  <td className="muted">{f.code}</td>
                  <td
                    className={`align-right amount ${f.balance < 0n ? "text-red" : ""}`}
                  >
                    {money(f.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={2}>Jumlah</th>
                <td className="align-right amount">
                  {money(data.funds.reduce((s, f) => s + f.balance, 0n))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>
      {user.role !== "USER" && (
        <div className="two-column-forms">
          <Panel
            title="Tambah akaun"
            description="Baki pembukaan disimpan sebagai rekod ledger."
          >
            <form action={createAccountAction} className="form-grid">
              <Field label="Kod akaun">
                <input
                  name="code"
                  placeholder="BANK-02"
                  maxLength={30}
                  required
                />
              </Field>
              <Field label="Jenis akaun">
                <select name="type">
                  <option value="BANK">Bank</option>
                  <option value="CASH">Tunai</option>
                  <option value="OTHER">Lain-lain</option>
                </select>
              </Field>
              <Field label="Nama akaun" wide>
                <input name="name" maxLength={100} required />
              </Field>
              <Field label="Baki pembukaan (RM)">
                <input
                  name="opening"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0.00"
                  required
                />
              </Field>
              <Field label="Tarikh pembukaan">
                <input
                  name="date"
                  type="date"
                  defaultValue={today()}
                  max={today()}
                  required
                />
              </Field>
              <Field label="Dana baki pembukaan" wide>
                <select name="fundId">
                  {data.funds
                    .filter((f) => f.active)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                </select>
              </Field>
              <div className="form-footer field-wide">
                <Submit>
                  <Plus size={16} />
                  Simpan akaun
                </Submit>
              </div>
            </form>
          </Panel>
          <Panel
            title="Tambah dana"
            description="Pilihan dana boleh ditambah tanpa mengubah kod."
          >
            <form action={createFundAction} className="form-grid">
              <Field label="Kod dana" wide>
                <input
                  name="code"
                  placeholder="DANA_BELIA"
                  maxLength={30}
                  required
                />
              </Field>
              <Field label="Nama dana" wide>
                <input
                  name="name"
                  placeholder="Dana Aktiviti Belia"
                  maxLength={100}
                  required
                />
              </Field>
              <Field label="Warna penanda">
                <input name="color" type="color" defaultValue="#247657" />
              </Field>
              <div className="form-footer field-wide">
                <Submit>
                  <Plus size={16} />
                  Simpan dana
                </Submit>
              </div>
            </form>
          </Panel>
        </div>
      )}
    </>
  );
}
