import type { MonthlyReport } from "@/lib/app/report";
import { duration } from "@/lib/monitor/watch";
import { DEPTH } from "@/lib/rank/serp";
import { PrintButton } from "./print-button";

const dayFmt = new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "long", timeZone: "UTC" });
const nf = new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 2 });
const day = (d: string) => dayFmt.format(new Date(`${d}T12:00:00Z`));

function Delta({ now, before, unit = "", lowerIsBetter = false }: { now: number | null | undefined; before: number | null | undefined; unit?: string; lowerIsBetter?: boolean }) {
  if (now == null || before == null) return null;
  const d = Math.round((now - before) * 10) / 10;
  if (!d) return <span className="text-xs text-text-muted">stable</span>;
  const good = lowerIsBetter ? d < 0 : d > 0;
  return <span className={`text-xs font-semibold ${good ? "text-success" : "text-danger"}`}>{d > 0 ? "+" : "−"}{nf.format(Math.abs(d))}{unit} <span className="sr-only">{good ? "(mieux)" : "(moins bien)"}</span></span>;
}

function Stat({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-4 break-inside-avoid">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-medium tabular-nums">{value}</p>
      {children && <p className="mt-1">{children}</p>}
    </div>
  );
}

/** Rapport mensuel d'un site, à la marque de l'agence (page imprimable en PDF). */
export function MonthlyReportView({ r, months }: { r: MonthlyReport; months?: Array<{ value: string; label: string; href: string }> }) {
  const b = r.branding;
  const accent = b.accent ?? "#0f766e";
  const demo = Boolean(r.positions?.demo || r.ai?.demo || r.search?.demo);
  return (
    <div className="mx-auto max-w-[860px] space-y-8 px-4 py-8 md:px-8 print:max-w-none print:px-0 print:py-0" style={{ ["--report-accent" as string]: accent }}>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-4 pb-5" style={{ borderColor: accent }}>
        <div className="min-w-0">
          {b.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.logoUrl} alt={b.agencyName || "Logo de l'agence"} className="mb-3 max-h-12 max-w-[220px] object-contain" />
          ) : b.agencyName ? <p className="mb-2 font-display text-lg font-semibold" style={{ color: accent }}>{b.agencyName}</p> : null}
          <h1 className="text-3xl leading-tight">Rapport de {r.label}</h1>
          <p className="mt-1 text-text-muted">{r.site.name} · {r.site.host}{r.partial ? ` · du 1er au ${day(new Date().toISOString().slice(0, 10))} (mois en cours)` : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {months && months.length > 1 && (
            <nav aria-label="Autres mois" className="flex flex-wrap gap-1 text-sm">
              {months.map((m) => <a key={m.value} href={m.href} aria-current={m.value === r.month ? "page" : undefined} className={`rounded-md px-2 py-1 ${m.value === r.month ? "bg-surface-sunken font-semibold" : "text-text-muted hover:underline"}`}>{m.label}</a>)}
            </nav>
          )}
          <PrintButton />
        </div>
      </header>

      {demo && <p className="rounded-md bg-info-soft px-3 py-2 text-sm text-info">Certains chiffres sont des exemples : les services correspondants ne sont pas encore branchés.</p>}

      <section aria-labelledby="r-summary" className="space-y-3 break-inside-avoid">
        <h2 id="r-summary" className="text-lg" style={{ color: accent }}>L'essentiel</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
          <Stat label="Articles publiés" value={String(r.articles.length)} />
          <Stat label="Mots-clés sur la 1re page" value={r.positions?.now ? `${r.positions.now.top10} / ${r.positions.tracked}` : "—"}><Delta now={r.positions?.now?.top10} before={r.positions?.before?.top10} /></Stat>
          <Stat label="Visibilité dans les IA" value={r.ai?.score == null ? "—" : `${r.ai.score} %`}><Delta now={r.ai?.score} before={r.ai?.before} unit=" pt" /></Stat>
          <Stat label="Site disponible" value={r.uptime.pct == null ? "—" : `${nf.format(r.uptime.pct)} %`}>{r.uptime.incidents ? <span className="text-xs text-danger">{r.uptime.incidents} panne{r.uptime.incidents > 1 ? "s" : ""}</span> : <span className="text-xs text-text-muted">aucune panne</span>}</Stat>
        </div>
      </section>

      <section aria-labelledby="r-articles" className="space-y-2">
        <h2 id="r-articles" className="text-lg" style={{ color: accent }}>Articles publiés</h2>
        {!r.articles.length ? <p className="text-sm text-text-muted">Aucun article publié ce mois-ci.</p> : (
          <ol className="divide-y divide-border rounded-lg border border-border text-sm">
            {r.articles.map((a) => (
              <li key={a.title + a.day} className="flex flex-wrap justify-between gap-2 px-4 py-2.5 break-inside-avoid">
                <span className="min-w-0">{a.url ? <a href={a.url} className="underline underline-offset-2">{a.title}</a> : a.title}</span>
                <span className="text-text-muted">{day(a.day)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {r.positions && (
        <section aria-labelledby="r-positions" className="space-y-3">
          <h2 id="r-positions" className="text-lg" style={{ color: accent }}>Positions dans Google</h2>
          {!r.positions.now ? <p className="text-sm text-text-muted">Pas encore de mesure ce mois-ci.</p> : (
            <>
              <div className="grid gap-3 sm:grid-cols-3 print:grid-cols-3">
                <Stat label="Dans le top 3" value={String(r.positions.now.top3)}><Delta now={r.positions.now.top3} before={r.positions.before?.top3} /></Stat>
                <Stat label="Sur la 1re page (top 10)" value={String(r.positions.now.top10)}><Delta now={r.positions.now.top10} before={r.positions.before?.top10} /></Stat>
                <Stat label="Position moyenne" value={r.positions.now.average == null ? "—" : nf.format(r.positions.now.average)}><Delta now={r.positions.now.average} before={r.positions.before?.average} lowerIsBetter /></Stat>
              </div>
              <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
                <div className="break-inside-avoid">
                  <h3 className="text-sm font-semibold">Meilleures progressions</h3>
                  {!r.positions.movers.length ? <p className="mt-1 text-sm text-text-muted">{r.positions.before ? "Pas de progression ce mois-ci." : "Premier mois suivi : la comparaison viendra le mois prochain."}</p> : (
                    <ul className="mt-1 text-sm">{r.positions.movers.map((m) => <li key={m.phrase} className="flex justify-between gap-3 py-1"><span className="min-w-0 truncate">{m.phrase}</span><span className="tabular-nums text-text-muted">{m.before ?? `après ${DEPTH}`} → <strong className="text-success">{m.now}</strong></span></li>)}</ul>
                  )}
                </div>
                <div className="break-inside-avoid">
                  <h3 className="text-sm font-semibold">Sur la 1re page de Google</h3>
                  {!r.positions.best.length ? <p className="mt-1 text-sm text-text-muted">Aucun mot-clé dans les 10 premiers pour l'instant.</p> : (
                    <ul className="mt-1 text-sm">{r.positions.best.map((m) => <li key={m.phrase} className="flex justify-between gap-3 py-1"><span className="min-w-0 truncate">{m.phrase}</span><span className="tabular-nums font-semibold">{m.position}<span className="sr-only">e place</span></span></li>)}</ul>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {r.ai && (
        <section aria-labelledby="r-ai" className="space-y-2 break-inside-avoid">
          <h2 id="r-ai" className="text-lg" style={{ color: accent }}>Visibilité dans les IA</h2>
          <p className="text-sm">{r.ai.engines.join(", ")} citent {r.site.host} ou s'appuient sur le site dans <strong>{r.ai.seen} réponse{r.ai.seen > 1 ? "s" : ""} sur {r.ai.total}</strong> aux questions que posent ses clients{r.ai.before != null ? ` (${r.ai.before} % le mois d'avant)` : ""}.</p>
        </section>
      )}

      {r.search && (
        <section aria-labelledby="r-search" className="space-y-3 break-inside-avoid">
          <h2 id="r-search" className="text-lg" style={{ color: accent }}>Visites depuis Google ({r.search.days} derniers jours)</h2>
          <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
            <Stat label="Clics" value={r.search.clicks.toLocaleString("fr-CH")}><Delta now={r.search.clicks} before={r.search.prevClicks} /></Stat>
            <Stat label="Affichages dans Google" value={r.search.impressions.toLocaleString("fr-CH")}><Delta now={r.search.impressions} before={r.search.prevImpressions} /></Stat>
          </div>
        </section>
      )}

      {r.visits && (
        <section aria-labelledby="r-visits" className="space-y-3 break-inside-avoid">
          <h2 id="r-visits" className="text-lg" style={{ color: accent }}>Visiteurs du site</h2>
          <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
            <Stat label="Visiteurs" value={r.visits.visitors.toLocaleString("fr-CH")}><Delta now={r.visits.visitors} before={r.visits.prevVisitors} /></Stat>
            <Stat label="Pages vues" value={r.visits.pageviews.toLocaleString("fr-CH")}><Delta now={r.visits.pageviews} before={r.visits.prevPageviews} /></Stat>
          </div>
          <p className="text-xs text-text-muted">Mesurés sans cookies : un visiteur est compté une fois par jour.</p>
        </section>
      )}

      <section aria-labelledby="r-uptime" className="space-y-2 break-inside-avoid">
        <h2 id="r-uptime" className="text-lg" style={{ color: accent }}>Disponibilité du site</h2>
        <p className="text-sm">{r.uptime.checks ? <>Vérifié toutes les 5 minutes ({r.uptime.checks.toLocaleString("fr-CH")} vérifications) : disponible {r.uptime.pct == null ? "—" : `${nf.format(r.uptime.pct)} %`} du temps{r.uptime.incidents ? `, ${r.uptime.incidents} panne${r.uptime.incidents > 1 ? "s" : ""} pour ${duration(r.uptime.downtimeMs)} au total` : ", sans panne"}.</> : "Pas encore de vérification ce mois-ci."}</p>
      </section>

      <footer className="border-t border-border pt-4 text-xs text-text-muted">
        {b.agencyName ? <>{b.agencyName}{b.contact ? ` · ${b.contact}` : ""}</> : "Rapport préparé avec Altiseo"}
      </footer>
    </div>
  );
}
