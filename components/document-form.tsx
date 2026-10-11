import { createDocumentAction, updateDocumentAction } from "@/app/actions";
import { Field } from "./ui";
import { Submit } from "./form-controls";
import { today } from "@/lib/money";

type Option = { id: string; name: string };
type Initial = {
  id: string;
  type: "RESIT" | "BAUCER";
  date: string;
  party: string;
  amount: string;
  description: string;
  accountId: string;
  fundId: string;
  category: string;
  paymentMethod: string;
  reference: string;
};
export function DocumentForm({
  accounts,
  funds,
  due,
  initial,
}: {
  accounts: Option[];
  funds: Option[];
  due?: { id: string; name: string; amount: string };
  initial?: Initial;
}) {
  return (
    <form
      action={initial ? updateDocumentAction : createDocumentAction}
      className="form-grid"
    >
      {initial && <input type="hidden" name="id" value={initial.id} />}
      {due && <input type="hidden" name="dueId" value={due.id} />}
      <Field label="Jenis dokumen">
        <select
          name="type"
          defaultValue={initial?.type ?? (due ? "RESIT" : "BAUCER")}
        >
          {!due && (!initial || initial.type === "BAUCER") && (
            <option value="BAUCER">Baucer — wang keluar</option>
          )}
          {(!initial || initial.type === "RESIT") && (
            <option value="RESIT">Resit — wang masuk</option>
          )}
        </select>
      </Field>
      <Field label="Tarikh dokumen">
        <input
          type="date"
          name="date"
          defaultValue={initial?.date ?? today()}
          max={today()}
          required
        />
      </Field>
      <Field label="Nama pembayar / penerima">
        <input
          name="party"
          placeholder="Contoh: Pejabat Daerah"
          defaultValue={initial?.party ?? due?.name}
          readOnly={!!due}
          maxLength={200}
          required
        />
      </Field>
      <Field label="Amaun (RM)">
        <input
          name="amount"
          type="number"
          inputMode="decimal"
          min="0.01"
          max="9999999999.99"
          step="0.01"
          placeholder="0.00"
          defaultValue={initial?.amount ?? due?.amount}
          readOnly={!!due}
          required
        />
      </Field>
      <Field label="Butiran transaksi" wide>
        <textarea
          name="description"
          placeholder="Nyatakan tujuan bayaran atau penerimaan…"
          defaultValue={
            initial?.description ?? (due ? `Yuran ahli — ${due.name}` : "")
          }
          maxLength={1000}
          rows={3}
          required
        />
      </Field>
      <Field label="Akaun kewangan">
        <select name="accountId" defaultValue={initial?.accountId} required>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Dana">
        <select name="fundId" defaultValue={initial?.fundId} required>
          {funds.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Kategori">
        <input
          name="category"
          list="categories"
          defaultValue={initial?.category ?? (due ? "Yuran ahli" : "")}
          placeholder="Pilih atau masukkan kategori"
          maxLength={100}
          required
        />
        <datalist id="categories">
          {[
            "Peruntukan",
            "Sumbangan",
            "Yuran ahli",
            "Sewaan",
            "Utiliti",
            "Pentadbiran",
            "Penyelenggaraan",
            "Program komuniti",
            "Lain-lain",
          ].map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <Field label="Kaedah bayaran">
        <select name="paymentMethod" defaultValue={initial?.paymentMethod}>
          <option value="BANK">Pindahan bank</option>
          <option value="TUNAI">Tunai</option>
        </select>
      </Field>
      <Field label="No. rujukan bank / cek (pilihan)" wide>
        <input
          name="reference"
          defaultValue={initial?.reference}
          maxLength={100}
          placeholder="Contoh: nombor transaksi e-banker"
        />
      </Field>
      <div className="form-footer field-wide">
        <p>Draf tidak mengubah baki. Hantar untuk semakan selepas disimpan.</p>
        <Submit>{initial ? "Simpan perubahan draf" : "Simpan draf"}</Submit>
      </div>
    </form>
  );
}
