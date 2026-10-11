"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  ChartNoAxesCombined,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  X,
  ArrowUpRight,
  Bell,
} from "lucide-react";
import { logoutAction } from "@/app/actions";

const links = [
  { href: "/dashboard", label: "Gambaran keseluruhan", icon: LayoutDashboard },
  { href: "/dashboard/buku-tunai", label: "Buku tunai", icon: BookOpen },
  { href: "/dashboard/baucer-resit", label: "Resit & baucer", icon: FileText },
  { href: "/dashboard/yuran", label: "Yuran ahli", icon: Users },
  { href: "/dashboard/akaun", label: "Akaun & dana", icon: Wallet },
  {
    href: "/dashboard/rumusan",
    label: "Rumusan kewangan",
    icon: ChartNoAxesCombined,
  },
];
const roleNames: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Pentadbir",
  USER: "Pengguna",
};
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand ${compact ? "brand-compact" : ""}`}>
      <span className="brand-symbol" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>
        Kira<span className="brand-light">Rapi</span>
        <small>KEWANGAN KOMUNITI</small>
      </span>
    </span>
  );
}
export function Shell({
  children,
  name,
  role,
  organization,
  pending,
  demo,
}: {
  children: React.ReactNode;
  name: string;
  role: string;
  organization: string;
  pending: number;
  demo: boolean;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const current =
    links.find((l) =>
      l.href === "/dashboard" ? path === l.href : path.startsWith(l.href),
    )?.label ?? (path.includes("audit") ? "Jejak audit" : "Tetapan");
  return (
    <div className="app-shell">
      {open && (
        <button
          className="nav-backdrop"
          onClick={() => setOpen(false)}
          aria-label="Tutup menu"
        />
      )}
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <Link
          href="/dashboard"
          className="brand-link"
          aria-label="Kira Rapi — dashboard"
        >
          <Brand />
        </Link>
        <button
          className="icon-button mobile-close"
          onClick={() => setOpen(false)}
          aria-label="Tutup menu"
        >
          <X size={20} />
        </button>
        <div className="org-switch">
          <span className="org-avatar">KH</span>
          <div>
            <strong>{organization}</strong>
            <small>Ruang kerja organisasi</small>
          </div>
        </div>
        <p className="nav-caption">RUANG KEWANGAN</p>
        <nav aria-label="Navigasi utama">
          {links.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/dashboard" ? path === href : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`nav-link ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={19} strokeWidth={1.7} />
                <span>{label}</span>
                {href.endsWith("baucer-resit") && pending > 0 && (
                  <span className="nav-count">{pending}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <p className="nav-caption">PENGURUSAN</p>
        <nav aria-label="Pengurusan">
          <Link
            href="/dashboard/audit"
            onClick={() => setOpen(false)}
            className={`nav-link ${path.includes("audit") ? "active" : ""}`}
          >
            <ShieldCheck size={19} strokeWidth={1.7} />
            Jejak audit
          </Link>
          <Link
            href="/dashboard/settings"
            onClick={() => setOpen(false)}
            className={`nav-link ${path.includes("settings") ? "active" : ""}`}
          >
            <Settings size={19} strokeWidth={1.7} />
            Tetapan
          </Link>
        </nav>
        <div className="sidebar-note">
          <div className="note-spark">✳</div>
          <strong>Setiap sen, lebih teratur.</strong>
          <p>Rekod yang jelas untuk komuniti yang lebih baik.</p>
          <Link href="/dashboard/rumusan">
            Semak rumusan <ArrowUpRight size={15} />
          </Link>
        </div>
        <form action={logoutAction} className="sidebar-user">
          <span className="avatar">
            {name
              .split(" ")
              .slice(0, 2)
              .map((x) => x[0])
              .join("")}
          </span>
          <div>
            <strong>{name}</strong>
            <small>{roleNames[role]}</small>
          </div>
          <button
            className="icon-button"
            title="Log keluar"
            aria-label="Log keluar"
          >
            <LogOut size={18} />
          </button>
        </form>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              onClick={() => setOpen(true)}
              aria-label="Buka menu"
              aria-expanded={open}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              Ruang kerja <span>/</span> <strong>{current}</strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="workspace-state">
              <i />
              {demo ? "Ruang demonstrasi" : "Ruang organisasi"}
            </span>
            <Link
              className="notification"
              href="/dashboard/baucer-resit?status=PENDING"
              aria-label={`${pending} dokumen menunggu kelulusan`}
            >
              <Bell size={20} />
              {pending > 0 && <i />}
            </Link>
            <span className="avatar avatar-small">{name[0]}</span>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>© {new Date().getFullYear()} Kira Rapi</span>
          <span>Urus kewangan dengan lebih rapi.</span>
        </footer>
      </div>
    </div>
  );
}
