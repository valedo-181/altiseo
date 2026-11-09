import Link from "next/link";
import { LogOut, Menu } from "lucide-react";
import { signOut, switchSite } from "@/app/actions";
import { Logo } from "@/components/brand/logo";
import { Banner } from "@/components/ui/feedback";
import { QuotaBar } from "@/components/ui/card";
import type { Site, User } from "@/lib/domain/types";
import { NAV } from "./nav";
import { SideNav, TabBar } from "./nav-links";

type Props = {
  user: User;
  site: Site;
  sites: Site[];
  quota: { used: number; total: number; trialEndsAt: string | null } | null;
  /** Ce qui est encore simulé (rien = tout est branché). */
  simulated: { ai: boolean; cms: boolean; data: boolean };
  children: React.ReactNode;
};

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400_000));
}

export function AppShell({ user, site, sites, quota, simulated, children }: Props) {
  const trial = daysLeft(quota?.trialEndsAt ?? null);
  return (
    <div className="min-h-dvh bg-surface">
      <a href="#contenu" className="sr-only z-50 rounded-md bg-accent px-4 py-2 text-on-accent focus:not-sr-only focus:fixed focus:left-2 focus:top-2">Aller au contenu</a>

      <aside className="fixed inset-y-0 left-0 z-10 hidden w-sidebar flex-col border-r border-border bg-bg p-4 lg:flex">
        <Link href="/app" className="mb-6 px-2"><Logo size={28} /></Link>
        <SideNav />
        <div className="mt-auto space-y-3 border-t border-border pt-4">
          {quota && (
            <div className="px-2">
              <p className="text-xs text-text-muted">Articles ce mois : <span className="font-semibold text-text tabular-nums">{quota.used} / {quota.total}</span></p>
              <QuotaBar used={quota.used} total={quota.total} />
            </div>
          )}
          <div className="flex items-center justify-between gap-2 px-2">
            <p className="min-w-0 truncate text-sm" title={user.email}>{user.name ?? user.email}</p>
            <form action={signOut}><button className="btn btn-ghost btn-sm btn-icon" aria-label="Se déconnecter"><LogOut aria-hidden="true" className="size-4" /></button></form>
          </div>
        </div>
      </aside>

      <div className="lg:pl-sidebar">
        <header className="sticky top-0 z-10 flex h-topbar items-center gap-3 border-b border-border bg-bg px-4 md:px-6">
          <Link href="/app" className="lg:hidden"><Logo size={24} /></Link>
          <form action={switchSite} className="ml-auto flex min-w-0 items-center gap-2 lg:ml-0">
            <label htmlFor="site-select" className="sr-only">Site</label>
            {sites.length > 1 ? (
              <>
                <select id="site-select" name="siteId" defaultValue={site.id} className="field h-9 max-w-[220px] py-0 text-sm">
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button className="btn btn-secondary btn-sm">Changer</button>
              </>
            ) : (
              <span className="truncate text-sm font-semibold" title={site.url}>{site.name} <span className="hidden font-normal text-text-muted sm:inline">· {site.url.replace("https://", "")}</span></span>
            )}
          </form>
          <details className="relative ml-auto lg:hidden">
            <summary className="btn btn-ghost btn-icon list-none" aria-label="Menu"><Menu aria-hidden="true" className="size-5" /></summary>
            <div className="absolute right-0 top-12 w-56 rounded-lg border border-border bg-bg p-2 shadow-pop">
              <ul>
                {NAV.slice(4).map((n) => <li key={n.href}><Link href={n.href} className="flex h-10 items-center rounded-md px-3 text-sm hover:bg-surface-sunken">{n.label}</Link></li>)}
              </ul>
              <form action={signOut} className="border-t border-border pt-2"><button className="flex h-10 w-full items-center rounded-md px-3 text-sm hover:bg-surface-sunken">Se déconnecter</button></form>
            </div>
          </details>
        </header>

        <main id="contenu" className="mx-auto max-w-content space-y-6 px-4 pb-24 pt-6 md:px-6 lg:pb-10">
          {(simulated.ai || simulated.cms || simulated.data || trial != null) && (
            <Banner tone="info">
              {(simulated.ai || simulated.cms || simulated.data) && (
                <>
                  <strong className="font-semibold">Mode démo :</strong>
                  {simulated.data && " données gardées sur ce serveur seulement."}
                  {simulated.ai && " les articles sont des textes d'exemple (sans IA)."}
                  {simulated.cms && " rien n'est envoyé à WordPress."}
                </>
              )}
              {trial != null && <> Essai : {trial} jour{trial > 1 ? "s" : ""} restant{trial > 1 ? "s" : ""}.</>}
            </Banner>
          )}
          {children}
        </main>
      </div>
      <TabBar />
    </div>
  );
}
