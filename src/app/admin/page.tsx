import Link from "next/link";
import { Search, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { buttonClass } from "@/components/ui/button";
import { Card, KpiCard } from "@/components/ui/card";
import { Banner, EmptyState } from "@/components/ui/feedback";
import { chf, FILTERS, matches, totals, type FilterKey } from "@/lib/admin/console";
import { adminContext, loadClients } from "@/lib/admin/context";
import { cx } from "@/lib/cx";
import { MfaScreen } from "./mfa";
import { day, HealthDot, StatusBadge } from "./ui";

/** Tableau de bord et liste des clients. */
export default async function AdminHome({ searchParams }: { searchParams: Promise<{ f?: string; q?: string; supprime?: string }> }) {
  const ctx = await adminContext();
  if (ctx.mfa !== "ok") return <MfaScreen ctx={ctx} />;
  const { f = "all", q = "", supprime } = await searchParams;
  const filter = (FILTERS.some(([k]) => k === f) ? f : "all") as FilterKey;
  const { clients, failed } = await loadClients(ctx, new Date());
  const t = totals(clients);
  const list = clients.filter((c) => matches(c, filter, q));
  const href = (k: string) => `/admin?${new URLSearchParams({ ...(k !== "all" ? { f: k } : {}), ...(q ? { q } : {}) })}`;

  return (
    <>
      <PageHeader title="Clients" lead={`${t.clients} espace${t.clients > 1 ? "s" : ""} · ${t.articles30} articles écrits en 30 jours`} actions={<Link href="/admin/clients/nouveau" className={buttonClass("primary")}>Nouveau client</Link>} />
      {supprime && <Banner tone="success">Le client et toutes ses données ont été supprimés.</Banner>}
      {failed && <Banner tone="danger">Les clients n'ont pas pu être chargés.</Banner>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Revenu mensuel" value={chf(t.mrr)} hint={`${t.paying} client${t.paying > 1 ? "s" : ""} payant${t.paying > 1 ? "s" : ""}`} />
        <KpiCard label="Coût IA (30 jours)" value={chf(t.cost30)} hint={`Marge : ${chf(t.margin)}`} tone={t.margin < 0 ? "danger" : "muted"} />
        <KpiCard label="Essais en cours" value={t.trials} hint={t.trialsEnding ? `${t.trialsEnding} se termine${t.trialsEnding > 1 ? "nt" : ""} sous 24 h` : "Aucun ne se termine sous 24 h"} />
        <KpiCard label="À surveiller" value={t.problems} hint={t.suspended ? `${t.suspended} suspendu${t.suspended > 1 ? "s" : ""}` : "Aucun client suspendu"} tone={t.problems ? "danger" : "muted"} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Filtrer" className="flex flex-wrap gap-2">
          {FILTERS.map(([k, label]) => (
            <Link key={k} href={href(k)} aria-current={filter === k ? "page" : undefined}
              className={cx("pill h-8 px-3 text-sm", filter === k ? "bg-accent text-on-accent" : "bg-bg text-text-muted ring-1 ring-border hover:text-text")}>
              {label} <span className="tabular-nums">{clients.filter((c) => matches(c, k, "")).length}</span>
            </Link>
          ))}
        </nav>
        <form className="ml-auto flex gap-2" role="search">
          {filter !== "all" && <input type="hidden" name="f" value={filter} />}
          <label htmlFor="q" className="sr-only">Chercher un client</label>
          <input id="q" name="q" defaultValue={q} placeholder="Nom, e-mail, site…" className="field h-9 w-56 text-sm" />
          <button className="btn btn-secondary btn-sm btn-icon" aria-label="Chercher"><Search aria-hidden="true" className="size-4" /></button>
        </form>
      </div>

      {!list.length ? (
        <EmptyState icon={Users} title={clients.length ? "Aucun client ne correspond" : "Pas encore de client"}>
          {clients.length ? "Changez de filtre ou de recherche." : "Les espaces apparaîtront ici dès la première inscription."}
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">Clients</caption>
            <thead className="bg-surface text-left text-text-muted">
              <tr>
                <th className="px-4 py-2 font-semibold">Client</th><th className="px-4 py-2 font-semibold">État</th>
                <th className="px-4 py-2 font-semibold">Articles</th><th className="px-4 py-2 text-right font-semibold">Revenu</th>
                <th className="px-4 py-2 text-right font-semibold">Coût IA 30 j</th><th className="px-4 py-2 font-semibold">Dernière connexion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((c) => (
                <tr key={c.id} className="hover:bg-surface">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <HealthDot health={c.health} />
                      <Link href={`/admin/clients/${c.id}`} className="font-semibold hover:underline">{c.name}</Link>
                    </div>
                    <p className="pl-[18px] text-xs text-text-muted">{c.email ?? "—"}{c.siteUrl ? ` · ${c.siteUrl.replace("https://", "")}` : ""}</p>
                    {c.reasons.length > 0 && <p className="pl-[18px] text-xs text-warning">{c.reasons.join(" · ")}</p>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge c={c} /><p className="mt-1 text-xs text-text-muted">{c.plan ?? "—"}</p></td>
                  <td className="px-4 py-3 tabular-nums">{c.articlesPeriod} / {c.quota}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.revenueChf ? chf(c.revenueChf) : "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.aiCost30Chf ? chf(c.aiCost30Chf, true) : "—"}</td>
                  <td className="px-4 py-3 text-text-muted">{day(c.lastSignIn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
