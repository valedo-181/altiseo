import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions";
import { Logo } from "@/components/brand/logo";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = { title: { default: "Console super admin", template: "%s · Super admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Coquille de la console. L'accès est vérifié par chaque page (adminContext) et par la base. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-border bg-bg">
        <div className="mx-auto max-w-content px-4 md:px-6">
          <div className="flex h-topbar items-center gap-3">
            <Link href="/admin" className="flex items-center gap-2"><Logo size={24} /><span className="pill bg-text text-bg">Super admin</span></Link>
            <Link href="/app" className="ml-auto text-sm text-text-muted hover:text-text">Retour à l'application</Link>
            <form action={signOut}><button className="btn btn-ghost btn-sm btn-icon" aria-label="Se déconnecter"><LogOut aria-hidden="true" className="size-4" /></button></form>
          </div>
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto max-w-content space-y-6 px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}
