"use client";
import { CircleAlert } from "lucide-react";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state error-state" role="alert">
      <span>
        <CircleAlert size={26} />
      </span>
      <h2>Rekod belum dapat dimuatkan.</h2>
      <p>
        Cuba muatkan semula. Jika masih berlaku, hubungi pentadbir organisasi.
      </p>
      <button className="button button-primary" onClick={reset}>
        Cuba semula
      </button>
    </div>
  );
}
