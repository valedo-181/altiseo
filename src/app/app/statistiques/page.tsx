import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Globe, MonitorSmartphone, MousePointerClick, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, KpiCard } from "@/components/ui/card";
import { Banner } from "@/components/ui/feedback";
import { siteOrigin } from "@/lib/config";
import { requireSite } from "@/lib/app/context";
import { statsPage } from "@/lib/app/stats";
import { hostOf } from "@/lib/geo/analyze";
import { snippet } from "@/lib/stats/collect";
import { countryName, peak, PERIODS, periodOf, receiving, type TopRow } from "@/lib/stats/summary";
import { Snippet, StatsSettings, VerifyInstall } from "./forms";

export const metadata: Metadata = { title: "Statistiques" };

const nf = new Intl.NumberFormat("fr-CH");
const dayFmt = new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "short", timeZone: "UTC" });
const longDay = new Intl.DateTimeFormat("fr-CH", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const when = new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich" });
const asDate = (d: string) => new Date(`${d}T12:00:00Z`);

function Change({ pct }: { pct: number | null }) {
  if (pct == null) return "Pas de période d'avant à comparer";
  if (pct === 0) return "Stable par rapport à la période d'avant";
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct)} % par rapport à la période d'avant`;
}

function TopList({ title, Icon, rows, unit, label = (v) => v, empty }: { title: string; Icon: typeof Globe; rows: TopRow[]; unit: string; label?: (v: string) => string; empty: string }) {
  return (
    <Card>
      <h2 className="flex items-center gap-2 text-lg"><Icon aria-hidden="true" className="size-5 text-accent" />{title}</h2>
      {!rows.length ? <p className="mt-2 text-sm text-text-muted">{empty}</p> : (
        <ul className="mt-3 space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.value} className="relative overflow-hidden rounded-md">
              <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-accent/10" style={{ width: `${Math.max(2, r.share)}%` }} />
              <span className="relative flex justify-between gap-3 px-2 py-1.5">
                <span className="min-w-0 truncate" title={label(r.value)}>{label(r.value)}</span>
                <span className="shrink-0 tabular-nums"><span className="font-semibold">{nf.format(r.count)}</span><span className="sr-only"> {unit}</span><span className="ml-2 text-text-muted">{r.share} %</span></span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Statistiques de visites sans cookies : visiteurs, pages vues, provenance, appareils, pays. */
export default async function Statistics({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { workspace, site } = await requireSite();
  const period = periodOf((await searchParams).p);
  const s = await statsPage(workspace.id, site.id, period);
  const host = hostOf(site.url) ?? site.url;
  const code = snippet(siteOrigin(process.env.NEXT_PUBLIC_SITE_URL), s.settings.siteKey);
  const live = receiving(s.settings.lastHitAt);
  const max = peak(s.series);
  const nothing = !s.totals.pageviews;
  const label = `Visiteurs par jour, du ${longDay.format(asDate(s.from))} au ${longDay.format(asDate(s.today))} : ${nf.format(s.totals.visitors)} au total, au plus ${nf.format(max)} un même jour.`;

  return (
    <>
      <PageHeader
        title="Statistiques"
        lead={`Qui visite ${host}, d'où viennent les visiteurs et ce qu'ils lisent. Sans cookies : pas de bandeau de consentement, aucune adresse IP enregistrée.`}
        actions={
          <nav aria-label="Période" className="flex gap-1 rounded-md bg-surface-sunken p-1 text-sm">
            {PERIODS.map((p) => (
              <Link key={p} href={`/app/statistiques?p=${p}`} aria-current={p === period ? "page" : undefined}
                className={`rounded px-3 py-1 font-semibold ${p === period ? "bg-surface shadow-sm" : "text-text-muted hover:text-text"}`}>{p} jours</Link>
            ))}
          </nav>
        }
      />

      {!s.settings.enabled && <Banner tone="info">La mesure est arrêtée : le script reste sur le site, mais rien n'est compté. Réactivez-la dans les réglages plus bas.</Banner>}
      {s.settings.enabled && !s.settings.lastHitAt && <Banner tone="info">Pas encore de visite reçue. Collez le code ci-dessous sur votre site : les premiers chiffres arrivent dès qu'une personne ouvre une page.</Banner>}

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label={`Visiteurs, ${period} jours`} value={nf.format(s.totals.visitors)} hint={<Change pct={s.changes.visitors} />} tone={s.changes.visitors != null && s.changes.visitors < 0 ? "danger" : s.changes.visitors ? "success" : "muted"} />
        <KpiCard label="Pages vues" value={nf.format(s.totals.pageviews)} hint={<Change pct={s.changes.pageviews} />} tone={s.changes.pageviews != null && s.changes.pageviews < 0 ? "danger" : s.changes.pageviews ? "success" : "muted"} />
        <KpiCard label="Pages par visiteur" value={s.totals.perVisitor == null ? "—" : String(s.totals.perVisitor).replace(".", ",")} hint="Plus c'est haut, plus les visiteurs lisent" />
      </div>

      <Card>
        <h2 className="text-lg">Visiteurs par jour</h2>
        {nothing ? <p className="mt-2 text-sm text-text-muted">Rien encore sur cette période.</p> : (
          <>
            <div role="img" aria-label={label} className="mt-4 flex h-40 items-end gap-px sm:gap-1">
              {s.series.map((d) => (
                <div key={d.day} title={`${longDay.format(asDate(d.day))} : ${nf.format(d.visitors)} visiteur${d.visitors > 1 ? "s" : ""}, ${nf.format(d.pageviews)} page${d.pageviews > 1 ? "s" : ""} vue${d.pageviews > 1 ? "s" : ""}`}
                  className="min-w-0 flex-1 rounded-t-sm bg-accent/70 hover:bg-accent" style={{ height: `${d.visitors ? Math.max(3, (d.visitors / max) * 100) : 0}%` }} />
              ))}
            </div>
            <div aria-hidden="true" className="mt-1 flex justify-between text-xs text-text-muted"><span>{dayFmt.format(asDate(s.from))}</span><span>{dayFmt.format(asDate(s.today))}</span></div>
          </>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopList title="Pages les plus vues" Icon={BarChart3} rows={s.pages} unit="pages vues" label={(v) => (v === "/" ? "Accueil" : v)} empty="Les pages apparaissent ici dès les premières visites." />
        <TopList title="D'où viennent les visiteurs" Icon={MousePointerClick} rows={s.sources} unit="visiteurs" label={(v) => (v === "Direct" ? "Direct (adresse tapée, favori, application)" : v)} empty="Google, ChatGPT, Facebook… : la provenance de chaque visiteur." />
        <TopList title="Appareils" Icon={MonitorSmartphone} rows={s.devices} unit="visiteurs" empty="Téléphone, tablette ou ordinateur." />
        <TopList title="Pays" Icon={Globe} rows={s.countries} unit="visiteurs" label={countryName} empty="Le pays de chaque visiteur, d'après son réseau." />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg">Installer sur votre site</h2>
            {live ? <span className="pill bg-success-soft text-success">Visites reçues</span> : s.settings.lastHitAt ? <span className="pill bg-warning-soft text-warning">Rien depuis 2 jours</span> : <span className="pill bg-surface-sunken text-text-muted">Pas encore installé</span>}
          </div>
          <p className="text-sm text-text-muted">Collez cette ligne une seule fois, juste avant <code>&lt;/head&gt;</code>, dans le modèle commun à toutes les pages (WordPress : extension « Insert Headers and Footers » ou réglages du thème).</p>
          <Snippet code={code} />
          <p className="text-xs text-text-muted">{s.settings.lastHitAt ? `Dernière visite reçue : ${when.format(new Date(s.settings.lastHitAt))}.` : "Aucune visite reçue pour l'instant."}</p>
          <VerifyInstall />
        </Card>
        <Card className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg"><ShieldCheck aria-hidden="true" className="size-5 text-accent" />Respect de la vie privée</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-text-muted">
            <li>Aucun cookie, rien n'est gardé dans le navigateur.</li>
            <li>L'adresse IP n'est jamais enregistrée : elle sert à reconnaître un visiteur le même jour, puis cette trace est effacée.</li>
            <li>Les paramètres des adresses (e-mails, codes) ne sont pas gardés.</li>
            <li>Conçu pour la LPD suisse et le RGPD : sans cookie ni donnée personnelle gardée, un bandeau de consentement n'est en principe pas nécessaire.</li>
          </ul>
          <StatsSettings enabled={s.settings.enabled} />
        </Card>
      </div>
    </>
  );
}
