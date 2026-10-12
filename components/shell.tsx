"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  Building2,
  Files,
  ChevronRight,
} from "lucide-react";
import { logoutAction } from "@/app/actions";
import { ThemeToggle } from "@/components/theme-toggle";

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
  { href: "/dashboard/laporan-excel", label: "Laporan Excel", icon: Files },
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
  const sidebar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        sidebar.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex="0"]',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const desktop = window.matchMedia("(min-width: 1101px)");
    const onResize = () => {
      if (desktop.matches) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    desktop.addEventListener("change", onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onResize);
      menuButton.current?.focus();
    };
  }, [open]);
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
          aria-label="Tutup lapisan menu"
          tabIndex={-1}
        />
      )}
      <aside
        id="workspace-navigation"
        ref={sidebar}
        className={`sidebar ${open ? "is-open" : ""}`}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? "Menu ruang kerja" : "Ruang kerja organisasi"}
      >
        <Link
          href="/dashboard"
          className="brand-link"
          aria-label="Kira Rapi — dashboard"
          onClick={() => setOpen(false)}
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
          <span className="org-avatar">
            <Building2 size={19} />
          </span>
          <div>
            <strong>{organization}</strong>
            <small>Ruang kerja organisasi</small>
          </div>
        </div>
        <p className="nav-caption">KEWANGAN</p>
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
            aria-current={path.includes("audit") ? "page" : undefined}
          >
            <ShieldCheck size={19} strokeWidth={1.7} />
            Jejak audit
          </Link>
          <Link
            href="/dashboard/settings"
            onClick={() => setOpen(false)}
            className={`nav-link ${path.includes("settings") ? "active" : ""}`}
            aria-current={path.includes("settings") ? "page" : undefined}
          >
            <Settings size={19} strokeWidth={1.7} />
            Tetapan
          </Link>
        </nav>
        <div className="sidebar-note">
          <Files size={20} aria-hidden="true" />
          <strong>Laporan, sedia dibentang.</strong>
          <p>Jana Excel berpaut atau PDF dalam format organisasi.</p>
          <Link href="/dashboard/laporan-excel" onClick={() => setOpen(false)}>
            Buka laporan <ArrowUpRight size={16} />
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
      <div className="workspace" inert={open || undefined}>
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              ref={menuButton}
              onClick={() => setOpen(true)}
              aria-label="Buka menu"
              aria-expanded={open}
              aria-controls="workspace-navigation"
            >
              <Menu size={22} />
            </button>
            <div className="breadcrumb">
              <span className="breadcrumb-root">Ruang kerja</span>
              <ChevronRight size={14} aria-hidden="true" />
              <strong>{current}</strong>
            </div>
          </div>
          <div className="topbar-right">
            <span className="workspace-state">
              <i />
              {demo ? "Ruang demonstrasi" : "Ruang organisasi"}
            </span>
            <ThemeToggle />
            <Link
              className="notification"
              href="/dashboard/baucer-resit?status=PENDING"
              aria-label={`${pending} dokumen menunggu kelulusan`}
            >
              <Bell size={20} />
              {pending > 0 && <i />}
            </Link>
            <Link
              href="/dashboard/settings"
              className="topbar-profile"
              aria-label={`Tetapan akaun ${name}`}
            >
              <span className="avatar avatar-small">{name[0]}</span>
              <span>
                <strong>{name.split(" ")[0]}</strong>
                <small>{roleNames[role]}</small>
              </span>
            </Link>
          </div>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>
          {children}
        </main>
        <footer className="app-footer">
          <span>© {new Date().getFullYear()} Kira Rapi</span>
          <span>Kewangan komuniti, diurus bersama.</span>
        </footer>
      </div>
    </div>
  );
}
