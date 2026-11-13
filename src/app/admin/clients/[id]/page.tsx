import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, KpiCard } from "@/components/ui/card";
import { Banner } from "@/components/ui/feedback";
import { ACTION_LABEL, chf, describe } from "@/lib/admin/console";
import { adminContext, loadClients, loadDetail, loadJournal } from "@/lib/admin/context";
import { MfaScreen } from "../../mfa";
import { day, dayTime, HealthDot, StatusBadge } from "../../ui";
import { DeleteForm, NoteForm, PlanForm, SuspendForm, TrialForm } from "./forms";

export const metadata: Metadata = { title: "Client" };

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cree?: string }> }) {
  const ctx = await adminContext();
  if (ctx.mfa !== "ok") return <MfaScreen ctx={ctx} />;
  const { id } = await params;
  const { clients } = await loadClients(ctx, new Date());
  const c = clients.find((x) => x.id === id);
  if (!c) notFound();
  const [journal, detail, { cree }] = await Promise.all([loadJournal(ctx, c.id, 50), loadDetail(ctx, c.id), searchParams]);
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
      {cree && <Banner tone="success">Client créé. Aucun e-mail n'a été envoyé : dites à {c.email ?? "la personne"} de se connecter sur la page de connexion avec son adresse.</Banner>}
      {c.status === "suspended" && <Banner tone="danger">Suspendu. Raison : {c.suspendedReason ?? "—"}</Banner>}
      {c.reasons.length > 0 && <Banner tone="warning">{c.reasons.join(" · ")}</Banner>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Articles ce mois" value={`${c.articlesPeriod} / ${c.quota}`} hint={`${c.articlesTotal} au total`} />
        <KpiCard label="Revenu mensuel" value={c.revenueChf ? chf(c.revenueChf) : "—"} hint={c.plan ? `Offre ${c.plan}` : "Sans offre"} />
        <KpiCard label="Coût IA (30 jours)" value={chf(c.aiCost30Chf, true)} hint={c.costPerArticleChf != null ? `${chf(c.costPerArticleChf, true)} par article` : "Pas encore d'article"} />
        <KpiCard label="Marge" value={c.revenueChf ? chf(c.marginChf) : "—"} hint={c.marginPct != null ? `${c.marginPct} % du prix` : "Pas de revenu pendant l'essai"} tone={c.marginChf < 0 ? "danger" : "muted"} />
      </div>
      <p className="text-sm text-text-muted">Dernière connexion : {day(c.lastSignIn)} · dernier article : {day(c.lastArticleAt)} · {c.failed} échec{c.failed > 1 ? "s" : ""} en attente{c.failed ? <> (<Link href="/admin/technique" className="text-accent underline underline-offset-2">voir</Link>)</> : null}</p>

      {!detail ? <Banner tone="warning">Le détail de ce client demande une mise à jour de la base qui n'a pas encore été appliquée.</Banner> : (
        <>
          <section aria-labelledby="h-sites" className="space-y-3">
            <h2 id="h-sites" className="text-lg">Sites ({detail.sites.length})</h2>
            {!detail.sites.length ? <p className="text-sm text-text-muted">Aucun site : le client n'a pas commencé la configuration.</p> : (
              <Card className="divide-y divide-border p-0">
                {detail.sites.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{s.name} <span className="font-normal text-text-muted">· {s.url.replace("https://", "")}</span></p>
                      <p className="text-xs text-text-muted">{s.articles} article{s.articles > 1 ? "s" : ""}, dont {s.published} en ligne · {s.topics_approved} sujet{s.topics_approved > 1 ? "s" : ""} approuvé{s.topics_approved > 1 ? "s" : ""} en attente · {s.publish_mode === "publish" ? "publication directe" : "envoi en brouillon"}</p>
                    </div>
                    <span className={`pill ${s.configured ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>{s.configured ? "Configuré" : "Configuration en cours"}</span>
                    <span className="pill bg-surface-sunken text-text-muted">{s.integration ? `${s.integration === "github" ? "GitHub" : "WordPress"}${s.integration_simulated ? " (simulé)" : ""}` : "Pas de site connecté"}</span>
                  </div>
                ))}
              </Card>
            )}
          </section>

          <section aria-labelledby="h-usage" className="space-y-3">
            <h2 id="h-usage" className="text-lg">Ce qu'il utilise</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <KpiCard label="Images créées" value={detail.usage.images} />
              <KpiCard label="Annonces préparées" value={detail.usage.ads} hint={`${detail.usage.ads_approved} validée${detail.usage.ads_approved > 1 ? "s" : ""}`} />
              <KpiCard label="Mots-clés suivis" value={detail.usage.rank_keywords} hint="Positions Google" />
              <KpiCard label="Questions suivies" value={detail.usage.ai_questions} hint="Visibilité IA" />
              <KpiCard label="Search Console" value={<span className="text-lg">{detail.usage.search_connected ? "Connecté" : "Non connecté"}</span>} />
            </div>
          </section>

          <section aria-labelledby="h-members" className="space-y-3">
            <h2 id="h-members" className="text-lg">Personnes ({detail.members.length})</h2>
            <Card className="divide-y divide-border p-0">
              {detail.members.map((m) => (
                <div key={m.email ?? m.joined} className="flex flex-wrap items-baseline gap-x-4 px-4 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-semibold">{m.email ?? "—"}</span>
                  <span className="text-text-muted">{m.role === "owner" ? "Responsable" : m.role === "admin" ? "Administrateur de l'espace" : "Membre"}</span>
                  <span className="text-text-muted">dernière connexion {day(m.last_sign_in)}</span>
                </div>
              ))}
            </Card>
          </section>

          <section aria-labelledby="h-note" className="space-y-3">
            <h2 id="h-note" className="text-lg">Note interne</h2>
            <Card><NoteForm id={c.id} note={detail.note ?? ""} />{detail.note_at && <p className="mt-2 text-xs text-text-muted">Modifiée le {dayTime(detail.note_at)}.</p>}</Card>
          </section>
        </>
      )}

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

      <section aria-labelledby="h-delete" className="space-y-3">
        <h2 id="h-delete" className="text-lg text-danger">Supprimer ce client</h2>
        <Card className="max-w-xl border-danger"><DeleteForm id={c.id} name={c.name} /></Card>
      </section>
    </>
  );
}
