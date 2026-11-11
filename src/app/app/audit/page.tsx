import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Gauge } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, ScoreGauge } from "@/components/ui/card";
import { Banner, EmptyState } from "@/components/ui/feedback";
import { requireSite } from "@/lib/app/context";
import { cx } from "@/lib/cx";
import { db } from "@/lib/data/store";
import type { AuditLevel } from "@/lib/domain/types";
import { CHECK_COUNT, issueScope, issueText, LEVEL_LABEL } from "@/lib/seo/report";
import { RunAudit } from "./run-button";

export const metadata: Metadata = { title: "Audit" };
/** La lecture du site prend jusqu'à une minute. */
export const maxDuration = 60;

const TONE: Record<AuditLevel, string> = { critical: "bg-danger-soft text-danger", warning: "bg-warning-soft text-warning", info: "bg-info-soft text-info" };
const when = new Intl.DateTimeFormat("fr-CH", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Zurich" });

/** S15 : audit SEO technique du site. */
export default async function Audit() {
  const { workspace, site } = await requireSite();
  const audit = await db.latestAudit(workspace.id, site.id);
  const host = site.url.replace("https://", "");

  if (!audit) {
    return (
      <>
        <PageHeader title="Audit SEO" lead={`La santé technique de ${host}, notée sur 100.`} />
        <EmptyState icon={Gauge} title="Pas encore d'audit" action={<RunAudit again={false} />}>
          Titres, descriptions, liens cassés, images, plan du site, vitesse sur téléphone : {CHECK_COUNT} contrôles, avec la correction à faire pour chacun.
        </EmptyState>
      </>
    );
  }

  const counts = { critical: 0, warning: 0, info: 0 } as Record<AuditLevel, number>;
  for (const i of audit.issues) counts[i.level]++;
  return (
    <>
      <PageHeader title="Audit SEO" lead={`${host}, audit du ${when.format(new Date(audit.createdAt))}.`} actions={<RunAudit again />} />
      {audit.status === "failed" ? (
        <Banner tone="danger">Le site n'a pas pu être lu : {audit.error}. Vérifiez qu'il est en ligne et qu'il ne bloque pas les robots, puis relancez l'audit.</Banner>
      ) : (
        <>
          <Card className="flex flex-wrap items-center gap-6">
            <ScoreGauge value={audit.score} size={96} />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold">{audit.score! >= 90 ? "Votre site est en bonne santé" : audit.score! >= 50 ? "Des points à corriger" : "Plusieurs problèmes sérieux"}</p>
              <p className="mt-1 text-sm text-text-muted">
                {audit.pagesCrawled} page{audit.pagesCrawled > 1 ? "s" : ""} lue{audit.pagesCrawled > 1 ? "s" : ""}.{" "}
                {audit.speed ? `Vitesse sur téléphone : ${audit.speed.score} sur 100.` : "La vitesse n'a pas pu être mesurée cette fois."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["critical", "warning", "info"] as AuditLevel[]).map((l) => (
                  <span key={l} className={cx("pill", counts[l] ? TONE[l] : "bg-surface-sunken text-text-muted")}>{counts[l]} {LEVEL_LABEL[l].toLowerCase()}{counts[l] > 1 ? "s" : ""}</span>
                ))}
              </div>
            </div>
          </Card>
          {!audit.issues.length ? (
            <EmptyState icon={CheckCircle2} title="Aucun problème trouvé">Les contrôles passent tous. Relancez l'audit après chaque changement important du site.</EmptyState>
          ) : (
            <section aria-labelledby="h-issues" className="space-y-3">
              <h2 id="h-issues" className="text-lg">À corriger, du plus grave au moins grave</h2>
              <Card className="divide-y divide-border p-0">
                {audit.issues.map((i) => (
                  <Link key={i.code} href={`/app/audit/${i.code}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-surface">
                    <span className={cx("pill", TONE[i.level])}>{LEVEL_LABEL[i.level]}</span>
                    <span className="min-w-0 flex-1 text-sm font-semibold">{issueText(i.code).title}</span>
                    <span className="text-xs text-text-muted">{issueScope(i)}</span>
                  </Link>
                ))}
              </Card>
            </section>
          )}
        </>
      )}
    </>
  );
}
