import Link from "next/link";
export default function NotFound() {
  return (
    <main className="empty-state" id="main-content">
      <h1>Rekod tidak dijumpai.</h1>
      <p>Pautan mungkin tidak tepat atau rekod tidak tersedia.</p>
      <Link href="/dashboard" className="button button-primary">
        Kembali ke dashboard
      </Link>
    </main>
  );
}
