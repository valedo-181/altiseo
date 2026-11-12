import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, KpiCard } from "@/components/ui/card";
import { Banner } from "@/components/ui/feedback";
import { requireSite } from "@/lib/app/context";
import { alertsConfigured } from "@/lib/app/monitor";
import { db } from "@/lib/data/store";
import { addDays } from "@/lib/domain/dates";
import { daysLeft, duration, uptime } from "@/lib/monitor/watch";
import { CheckNow, MonitorSettings } from "./forms";

export const metadata: Metadata = { title: "Gardien du site" };
export const maxDuration = 60;

const when = new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich" });
const dateFmt = new Intl.DateTimeFormat("fr-CH", { dateStyle: "long", timeZone: "Europe/Zurich" });
const nf = new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 2 });

function Expiry({ label, until, warnDays }: { label: string; until: string | null; warnDays: number }) {
  if (!until) return <KpiCard label={label} value="—" hint="Pas encore connue" tone="muted" />;
  const left = daysLeft(until, new Date());
  const tone = left < 0 ? "danger" : left <= warnDays ? "danger" : "muted";
  return <KpiCard label={label} value={left < 0 ? "Expiré" : `${left} jour${left > 1 ? "s" : ""}`} hint={`${left < 0 ? "Depuis le" : "Jusqu'au"} ${dateFmt.format(new Date(until))}`} tone={tone} />;
}

/** Gardien du site : disponibilité, pannes, certificat SSL et nom de domaine. */
export default async function Guardian() {
  const { user, workspace, site } = await requireSite();
  const host = site.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const today = new Date().toISOString().slice(0, 10);
  const [m, days, incidents] = await Promise.all([
    db.monitorOf(workspace.id, site.id), db.monitorDays(workspace.id, site.id, addDays(today, -29)), db.monitorIncidents(workspace.id, site.id, 10),
  ]);
  const up = uptime(days);
  const statusPill = !m.enabled ? <span className="pill bg-surface-sunken text-text-muted">Surveillance arrêtée</span>
    : m.status === "down" ? <span className="pill bg-danger-soft text-danger">Hors ligne{m.downSince ? ` depuis ${when.format(new Date(m.downSince))}` : ""}</span>
    : m.fails > 0 ? <span className="pill bg-warning-soft text-warning">Pas de réponse, nouvel essai dans 5 min</span>
    : m.status === "up" ? <span className="pill bg-success-soft text-success">En ligne</span>
    : <span className="pill bg-surface-sunken text-text-muted">Pas encore vérifié</span>;

  return (
    <>
      <PageHeader
        title="Gardien du site"
        lead={`${host} est vérifié toutes les 5 minutes. Vous recevez un e-mail s'il ne répond plus, et avant que le certificat SSL ou le nom de domaine n'expire.`}
        actions={<CheckNow />}
      />
      {!alertsConfigured() && <Banner tone="info">Les alertes par e-mail ne sont pas encore branchées sur ce serveur : l'état du site reste visible ici.</Banner>}
      {m.status === "down" && m.enabled && <Banner tone="danger">Votre site ne répond pas{m.lastStatusCode ? ` (erreur ${m.lastStatusCode})` : m.lastError ? ` (${m.lastError})` : ""}. Prévenez votre hébergeur si la panne dure.</Banner>}

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ShieldCheck aria-hidden="true" className="size-6 text-accent" />
          <div className="min-w-0">
            <p className="font-semibold">{host}</p>
            <p className="text-xs text-text-muted">{m.lastCheckedAt ? `Dernière vérification : ${when.format(new Date(m.lastCheckedAt))}${m.lastMs != null && !m.lastError ? `, réponse en ${m.lastMs} ms` : m.lastError ? `, ${m.lastError}` : ""}` : "Première vérification dans les 5 prochaines minutes."}</p>
          </div>
        </div>
        {statusPill}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Disponibilité, 30 jours" value={up.pct == null ? "—" : `${nf.format(up.pct)} %`} hint={up.checks ? `${up.checks.toLocaleString("fr-CH")} vérification${up.checks > 1 ? "s" : ""}` : "Pas encore de vérification"} tone={up.pct != null && up.pct < 99 ? "danger" : "muted"} />
        <KpiCard label="Temps de réponse moyen" value={up.avgMs == null ? "—" : `${up.avgMs} ms`} hint={up.avgMs == null ? "—" : up.avgMs > 1500 ? "Lent : les visiteurs et Google le remarquent" : "Bon"} tone={up.avgMs != null && up.avgMs > 1500 ? "danger" : "muted"} />
        <Expiry label="Certificat SSL" until={m.sslExpiresAt} warnDays={14} />
        <Expiry label="Nom de domaine" until={m.domainExpiresOn ? `${m.domainExpiresOn}T12:00:00Z` : null} warnDays={30} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg">Dernières pannes</h2>
          {!incidents.length ? <p className="mt-2 text-sm text-text-muted">Aucune panne enregistrée. Une panne n'est comptée qu'après deux vérifications ratées de suite.</p> : (
            <ul className="mt-2 divide-y divide-border text-sm">
              {incidents.map((i) => (
                <li key={i.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>{when.format(new Date(i.startedAt))}{i.endedAt ? ` → ${when.format(new Date(i.endedAt))}` : ""}<span className="block text-xs text-text-muted">{i.statusCode ? `Erreur ${i.statusCode}` : i.error ?? "Pas de réponse"}</span></span>
                  {i.endedAt ? <span className="pill bg-surface-sunken text-text-muted">{duration(new Date(i.endedAt).getTime() - new Date(i.startedAt).getTime())}</span> : <span className="pill bg-danger-soft text-danger">En cours</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="text-lg">Réglages</h2>
          <div className="mt-3">
            <MonitorSettings enabled={m.enabled} emails={m.alertEmails} domain={m.domainSource === "manual" || !m.domainExpiresOn ? m.domainExpiresOn ?? "" : ""} domainManual={m.domainSource === "manual"} defaultEmail={user.email} />
          </div>
        </Card>
      </div>
    </>
  );
}
