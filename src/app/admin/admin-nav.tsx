"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";

const NAV = [["/admin", "Clients"], ["/admin/revenus", "Revenus"], ["/admin/couts", "Coûts IA"], ["/admin/technique", "Suivi technique"], ["/admin/journal", "Journal"], ["/admin/admins", "Administrateurs"]] as const;

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Console" className="-mb-px flex gap-1 overflow-x-auto">
      {NAV.map(([href, label]) => {
        const on = href === "/admin" ? path === "/admin" || path.startsWith("/admin/clients") : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined}
            className={cx("whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium", on ? "border-accent text-accent" : "border-transparent text-text-muted hover:text-text")}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
