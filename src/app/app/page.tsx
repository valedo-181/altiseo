import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, FileText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { buttonClass } from "@/components/ui/button";
import { Card, KpiCard, QuotaBar, ScoreGauge } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { StatusPill } from "@/components/ui/status";
import { requireSite } from "@/lib/app/context";
import { db } from "@/lib/data/store";
import { formatDay, localDate } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Tableau de bord" };

/** S11 : tableau de bord. */
export default async function Dashboard() {
  const { workspace, site, subscription } = await requireSite();
  const [articles, calendar, audit] = await Promise.all([db.listArticles(workspace.id, site.id), db.listCalendar(workspace.id, site.id), db.latestAudit(workspace.id, site.id)]);
  const critical = audit?.issues.filter((i) => i.level === "critical").length ?? 0;
  const today = localDate(new Date(), site.timezone);
  const next = calendar.find((c) => c.scheduledFor >= today && (c.status === "approved" || c.status === "proposed"));
  const published = articles.filter((a) => a.status === "published").length;
  const drafts = articles.filter((a) => a.status === "draft").length;
  const toApprove = calendar.filter((c) => c.status === "proposed").length;
  return (
    <>
      <PageHeader title={`Bonjour${site.name ? `, ${site.name}` : ""}`} lead="Où en est votre blog aujourd'hui." actions={<Link href="/app/calendrier" className={buttonClass("primary")}>Voir le calendrier</Link>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Articles publiés" value={published} hint={drafts ? `${drafts} brouillon${drafts > 1 ? "s" : ""} à relire` : "Aucun brouillon en attente"} />
        <KpiCard
          label="Prochain article"
          value={<span className="text-lg">{next ? `${formatDay(next.scheduledFor)}, ${site.publishTime}` : "—"}</span>}
          hint={next ? next.title : "Aucun sujet prévu"}
        />
        <Card>
          <p className="text-sm text-text-muted">Quota du mois</p>
          <p className="text-2xl tabular-nums">{subscription?.used ?? 0} <span className="text-sm font-normal text-text-muted">/ {subscription?.articlesPerMonth ?? 0}</span></p>
          {subscription && <QuotaBar used={subscription.used} total={subscription.articlesPerMonth} />}
        </Card>
        <Card className="flex items-center gap-4">
          <ScoreGauge value={audit?.status === "done" ? audit.score : null} />
          <div><p className="text-sm text-text-muted">Santé SEO</p><Link href="/app/audit" className="text-sm font-semibold text-accent underline underline-offset-2">
            {!audit ? "Pas encore d'audit" : audit.status === "failed" ? "Audit à relancer" : critical ? `${critical} problème${critical > 1 ? "s" : ""} critique${critical > 1 ? "s" : ""}` : "Voir l'audit"}
          </Link></div>
        </Card>
      </div>

      {toApprove > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm"><strong className="font-semibold">{toApprove} sujet{toApprove > 1 ? "s" : ""}</strong> attend{toApprove > 1 ? "ent" : ""} votre accord.</p>
          <Link href="/app/calendrier" className={buttonClass("secondary", "sm")}>Les passer en revue</Link>
        </Card>
      )}

      <section aria-labelledby="h-last" className="space-y-3">
        <h2 id="h-last" className="text-lg">Derniers articles</h2>
        {articles.length === 0 ? (
          <EmptyState icon={FileText} title="Pas encore d'article" action={<Link href="/app/calendrier" className={buttonClass("primary", "sm")}><CalendarDays aria-hidden="true" className="size-4" />Écrire depuis le calendrier</Link>}>
            {next ? `Le premier est prévu ${formatDay(next.scheduledFor, { weekday: "long", day: "numeric", month: "long" })} à ${site.publishTime}. Vous pouvez aussi l'écrire maintenant.` : "Préparez vos sujets dans le calendrier."}
          </EmptyState>
        ) : (
          <Card className="divide-y divide-border p-0">
            {articles.slice(0, 5).map((a) => (
              <Link key={a.id} href={`/app/articles/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{a.title}</span>
                <StatusPill status={a.status === "archived" ? "skipped" : a.status} />
              </Link>
            ))}
          </Card>
        )}
      </section>
    </>
  );
}
