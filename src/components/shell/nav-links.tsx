"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";
import { NAV } from "./nav";


const active = (path: string, href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(`${href}/`));

export function SideNav() {
  const path = usePathname();
  return (
    <nav aria-label="Navigation principale">
      <ul className="space-y-0.5">
        {NAV.map(({ href, label, Icon, ...n }) => {
          const on = active(path, href, "exact" in n && n.exact);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={cx("flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-fast", on ? "bg-accent-soft text-accent" : "text-text-muted hover:bg-surface-sunken hover:text-text")}
              >
                <Icon aria-hidden="true" className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Barre du bas sur téléphone : les 4 écrans les plus utilisés ; le reste est dans le menu. */
export function TabBar() {
  const path = usePathname();
  return (
    <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg lg:hidden">
      <ul className="grid grid-cols-4">
        {NAV.slice(0, 4).map(({ href, label, Icon, ...n }) => {
          const on = active(path, href, "exact" in n && n.exact);
          return (
            <li key={href}>
              <Link href={href} aria-current={on ? "page" : undefined} className={cx("flex h-14 flex-col items-center justify-center gap-0.5 text-xs", on ? "text-accent" : "text-text-muted")}>
                <Icon aria-hidden="true" className="size-5" />
                {label === "Tableau de bord" ? "Accueil" : label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
