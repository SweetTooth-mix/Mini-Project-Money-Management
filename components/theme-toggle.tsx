"use client";
import { useI18n } from "@/components/language-provider";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const preferenceKey = "kira-rapi-theme";
type Theme = "light" | "dark";

export function ThemeToggle() {
  const { t } = useI18n();

  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => {
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(preferenceKey);
      } catch {
        /* Storage may be disabled. */
      }
      const next =
        saved === "light" || saved === "dark"
          ? saved
          : system.matches
            ? "dark"
            : "light";
      document.documentElement.dataset.theme = next;
      setTheme(next);
    };
    apply();
    system.addEventListener("change", apply);
    window.addEventListener("storage", apply);
    return () => {
      system.removeEventListener("change", apply);
      window.removeEventListener("storage", apply);
    };
  }, []);
  const label =
    theme === "dark" ? t("Aktifkan mod siang") : t("Aktifkan mod malam");
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={label}
      title={label}
      onClick={() => {
        const next =
          document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        setTheme(next);
        try {
          localStorage.setItem(preferenceKey, next);
        } catch {
          /* The current page still changes theme. */
        }
      }}
    >
      <Moon size={18} className="theme-moon" aria-hidden="true" />
      <Sun size={18} className="theme-sun" aria-hidden="true" />
      <span className="theme-label">
        {theme === "dark" ? t("Mod malam") : t("Mod siang")}
      </span>
    </button>
  );
}
