import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, KpiCard } from "@/components/ui/card";
import { Banner } from "@/components/ui/feedback";
import { chf, PLAN_LABEL, revenue } from "@/lib/admin/console";
import { adminContext, loadClients } from "@/lib/admin/context";
import { MfaScreen } from "../mfa";
import { day } from "../ui";

export const metadata: Metadata = { title: "Revenus" };

const weekFmt = new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "short", timeZone: "UTC" });

/** Revenus attendus selon les offres, essais à suivre et nouvelles inscriptions. */
export default async function Revenue() {
  const ctx = await adminContext();
  if (ctx.mfa !== "ok") return <MfaScreen ctx={ctx} />;
  const { clients, failed } = await loadClients(ctx, new Date());
  const r = revenue(clients, new Date());
  const max = Math.max(1, ...r.signups.map((s) => s.count));
  const total = r.signups.reduce((n, s) => n + s.count, 0);
  return (
    <>
      <PageHeader title="Revenus" lead="Ce que rapportent les offres en cours. Calculé d'après l'offre de chaque client : le paiement réel n'est pas encore branché (Stripe)." />
      {failed && <Banner tone="danger">Les clients n'ont pas pu être chargés.</Banner>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Revenu mensuel" value={chf(r.mrr)} hint={`${chf(r.arr)} sur un an`} />
        <KpiCard label="Si les essais s'abonnent" value={`+ ${chf(r.trialPotential)}`} hint="par mois, au prix de leur offre" />
        <KpiCard label="Essais devenus payants" value={r.conversionPct == null ? "—" : `${r.conversionPct} %`} hint={r.conversionPct == null ? "Aucun essai terminé pour l'instant" : "des essais terminés"} />
        <KpiCard label="Inscriptions, 8 semaines" value={total} hint={`${r.signups.at(-1)?.count ?? 0} cette semaine`} />
      </div>

      <section aria-labelledby="h-plans" className="space-y-3">
        <h2 id="h-plans" className="text-lg">Par offre</h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-surface text-left text-text-muted">
              <tr><th scope="col" className="px-4 py-2 font-semibold">Offre</th><th scope="col" className="px-4 py-2 text-right font-semibold">Payants</th><th scope="col" className="px-4 py-2 text-right font-semibold">En essai</th><th scope="col" className="px-4 py-2 text-right font-semibold">Revenu mensuel</th></tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {r.byPlan.map((p) => (
                <tr key={p.plan}><th scope="row" className="px-4 py-2.5 text-left font-semibold">{PLAN_LABEL[p.plan] ?? p.plan}</th><td className="px-4 py-2.5 text-right">{p.paying}</td><td className="px-4 py-2.5 text-right">{p.trials}</td><td className="px-4 py-2.5 text-right">{chf(p.mrr)}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section aria-labelledby="h-signups" className="space-y-3">
        <h2 id="h-signups" className="text-lg">Nouvelles inscriptions par semaine</h2>
        <Card>
          <ul className="space-y-2">
            {r.signups.map((s) => (
              <li key={s.week} className="grid grid-cols-[88px_1fr_32px] items-center gap-3 text-sm">
                <span className="text-text-muted">{weekFmt.format(new Date(`${s.week}T12:00:00Z`))}</span>
                <span className="h-3 rounded-sm bg-surface-sunken"><span className="block h-3 rounded-sm bg-[rgb(var(--c-chart))]" style={{ width: `${(s.count / max) * 100}%` }} /></span>
                <span className="text-right font-semibold tabular-nums">{s.count}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-text-muted">Chaque ligne commence le lundi indiqué.</p>
        </Card>
      </section>

      <section aria-labelledby="h-ending" className="space-y-3">
        <h2 id="h-ending" className="text-lg">Essais qui se terminent dans les 7 jours</h2>
        {!r.endingSoon.length ? <p className="text-sm text-text-muted">Aucun essai ne se termine cette semaine.</p> : (
          <Card className="divide-y divide-border p-0">
            {r.endingSoon.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <Link href={`/admin/clients/${c.id}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">{c.name}</Link>
                <span className="text-text-muted">{c.email ?? "—"}</span>
                <span className="text-text-muted">{PLAN_LABEL[c.plan ?? ""] ?? "—"} · {chf(c.priceChf)} / mois</span>
                <span className="pill bg-warning-soft text-warning">{c.trialDaysLeft === 0 ? "Aujourd'hui" : `Dans ${c.trialDaysLeft} j`}</span>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section aria-labelledby="h-lapsed" className="space-y-3">
        <h2 id="h-lapsed" className="text-lg">Essais terminés sans abonnement</h2>
        {!r.lapsed.length ? <p className="text-sm text-text-muted">Aucun.</p> : (
          <Card className="divide-y divide-border p-0">
            {r.lapsed.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <Link href={`/admin/clients/${c.id}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">{c.name}</Link>
                <span className="text-text-muted">{c.email ?? "—"}</span>
                <span className="text-text-muted">{c.articlesTotal} article{c.articlesTotal > 1 ? "s" : ""} · dernière connexion {day(c.lastSignIn)}</span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </>
  );
}
