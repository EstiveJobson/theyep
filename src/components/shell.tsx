"use client";

import { Home, Plus, UserRound, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import type { ReactNode } from "react";
import { INACTIVE_SCHOOL_NOTICE, PENDING_NOTICE_COOKIE } from "@/lib/pending-school-plan";

const THEME_KEY = "theyep-theme";

const TABS = [
  { href: "/", label: "Início", icon: Home },
  { href: "/postar", label: "Postar", icon: Plus },
  { href: "/perfil", label: "Perfil", icon: UserRound },
] as const;

function systemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#212121" : "#FFFFFF");
}

function ThemeToggle() {
  useLayoutEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    const dark = stored === "dark" || (stored !== "light" && systemDark());
    applyTheme(dark);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (localStorage.getItem(THEME_KEY)) return;
      applyTheme(media.matches);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    document.cookie = `${THEME_KEY}=${next ? "dark" : "light"}; Path=/; Max-Age=31536000; SameSite=Lax`;
    applyTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Alternar tema"
      className="grid size-11 place-items-center rounded-full text-fg hover:bg-line"
    >
      <Sun className="hidden size-5 dark:block" aria-hidden />
      <Moon className="block size-5 dark:hidden" aria-hidden />
    </button>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function TabLink({
  href,
  label,
  icon: Icon,
  pathname,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  pathname: string;
}) {
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "flex min-h-11 flex-col items-center justify-center gap-0.5 px-2 text-xs font-semibold " +
        (active ? "text-blue-ink" : "text-muted")
      }
    >
      <Icon className="size-6" aria-hidden strokeWidth={active ? 2.4 : 2} />
      {label}
    </Link>
  );
}

export function Shell({
  children,
  schoolNotice = false,
}: {
  children: ReactNode;
  schoolNotice?: boolean;
}) {
  const pathname = usePathname();
  const [notice, setNotice] = useState(schoolNotice);

  useEffect(() => {
    const fromCookie = document.cookie
      .split("; ")
      .some((part) => part.startsWith(`${PENDING_NOTICE_COOKIE}=`));
    if (!schoolNotice && !fromCookie) return;
    setNotice(true);
    document.cookie = `${PENDING_NOTICE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  }, [schoolNotice]);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-bg">
        <div className="shell flex h-14 items-center justify-between px-4">
          <Link href="/" className="inline-flex h-14 shrink-0 items-center">
            <img
              src="/logo-burst-soft.svg"
              alt="TheYep"
              width={970}
              height={836}
              className="h-[52px] w-auto dark:hidden"
            />
            <img
              src="/logo-dark-burst-soft.svg"
              alt="TheYep"
              width={970}
              height={836}
              className="hidden h-[52px] w-auto dark:block"
            />
          </Link>
          <div className="flex items-center gap-1">
            <nav className="hidden items-center md:flex" aria-label="Navegação principal">
              {TABS.map((tab) => (
                <TabLink key={tab.href} {...tab} pathname={pathname} />
              ))}
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="page-main shell px-4 pt-4">
        {notice ? (
          <p
            role="status"
            className="mb-3 rounded-lg bg-yellow px-3 py-2 text-sm font-semibold text-on-accent"
          >
            {INACTIVE_SCHOOL_NOTICE}
          </p>
        ) : null}
        {children}
      </main>
      <nav
        className="tabbar fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg md:hidden"
        aria-label="Navegação principal"
      >
        <div className="shell grid grid-cols-3">
          {TABS.map((tab) => (
            <TabLink key={tab.href} {...tab} pathname={pathname} />
          ))}
        </div>
      </nav>
    </>
  );
}
