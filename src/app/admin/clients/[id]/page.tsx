import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, KpiCard } from "@/components/ui/card";
import { Banner } from "@/components/ui/feedback";
import { ACTION_LABEL, chf, describe } from "@/lib/admin/console";
import { adminContext, loadClients, loadJournal } from "@/lib/admin/context";
import { MfaScreen } from "../../mfa";
import { day, dayTime, HealthDot, StatusBadge } from "../../ui";
import { PlanForm, SuspendForm, TrialForm } from "./forms";

export const metadata: Metadata = { title: "Client" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await adminContext();
  if (ctx.mfa !== "ok") return <MfaScreen ctx={ctx} />;
  const { id } = await params;
  const { clients } = await loadClients(ctx, new Date());
  const c = clients.find((x) => x.id === id);
  if (!c) notFound();
  const journal = await loadJournal(ctx, c.id, 50);
  const canTrial = c.status === "trial" || c.status === "trial_ended" || c.status === "canceled";

  return (
    <>
      <div className="space-y-2">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text"><ArrowLeft aria-hidden="true" className="size-4" />Clients</Link>
        <div className="flex flex-wrap items-center gap-3">
          <HealthDot health={c.health} />
          <h1 className="text-xl md:text-2xl">{c.name}</h1>
          <StatusBadge c={c} />
        </div>
        <p className="text-sm text-text-muted">{c.email ?? "—"}{c.siteUrl ? ` · ${c.siteUrl.replace("https://", "")}` : " · pas encore de site"} · inscrit le {day(c.createdAt)}</p>
      </div>
      {c.status === "suspended" && <Banner tone="danger">Suspendu. Raison : {c.suspendedReason ?? "—"}</Banner>}
      {c.reasons.length > 0 && <Banner tone="warning">{c.reasons.join(" · ")}</Banner>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Articles ce mois" value={`${c.articlesPeriod} / ${c.quota}`} hint={`${c.articlesTotal} au total`} />
        <KpiCard label="Revenu mensuel" value={c.revenueChf ? chf(c.revenueChf) : "—"} hint={c.plan ? `Offre ${c.plan}` : "Sans offre"} />
        <KpiCard label="Coût IA (30 jours)" value={chf(c.aiCost30Chf, true)} hint={c.costPerArticleChf != null ? `${chf(c.costPerArticleChf, true)} par article` : "Pas encore d'article"} />
        <KpiCard label="Marge" value={c.revenueChf ? chf(c.marginChf) : "—"} hint={c.marginPct != null ? `${c.marginPct} % du prix` : "Pas de revenu pendant l'essai"} tone={c.marginChf < 0 ? "danger" : "muted"} />
      </div>
      <p className="text-sm text-text-muted">Dernière connexion : {day(c.lastSignIn)} · dernier article : {day(c.lastArticleAt)} · {c.failed} échec{c.failed > 1 ? "s" : ""} en attente{c.failed ? <> (<Link href="/admin/technique" className="text-accent underline underline-offset-2">voir</Link>)</> : null}</p>

      <section aria-labelledby="h-actions" className="space-y-3">
        <h2 id="h-actions" className="text-lg">Actions</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>{canTrial ? <TrialForm id={c.id} /> : <p className="text-sm text-text-muted">Client payant : pas d'essai à prolonger.</p>}</Card>
          <Card><PlanForm id={c.id} plan={c.plan} /></Card>
          <Card><SuspendForm id={c.id} suspended={c.status === "suspended"} /></Card>
        </div>
      </section>

      <section aria-labelledby="h-journal" className="space-y-3">
        <h2 id="h-journal" className="text-lg">Journal de ce client</h2>
        {!journal.length ? <p className="text-sm text-text-muted">Aucune action de la console sur ce client.</p> : (
          <Card className="divide-y divide-border p-0">
            {journal.map((j, i) => (
              <div key={i} className="flex flex-wrap items-baseline gap-x-3 px-4 py-2 text-sm">
                <span className="w-32 text-text-muted">{dayTime(j.at)}</span>
                <span className="font-semibold">{ACTION_LABEL[j.action] ?? j.action}</span>
                <span className="text-text-muted">{describe(j.action, j.data)}</span>
                <span className="ml-auto text-xs text-text-muted">{j.admin_email ?? "—"}</span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </>
  );
}
