import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp, TrendingUp } from "lucide-react";
import { removeRankKeyword } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { Card, KpiCard } from "@/components/ui/card";
import { Banner, EmptyState } from "@/components/ui/feedback";
import { requireSite } from "@/lib/app/context";
import { thisWeek } from "@/lib/app/geo";
import { positionsLive } from "@/lib/app/positions";
import { db } from "@/lib/data/store";
import { addDays } from "@/lib/domain/dates";
import type { RankCheck } from "@/lib/domain/types";
import { hostOf } from "@/lib/geo/analyze";
import { DEPTH, locationOf, movement, summarize } from "@/lib/rank/serp";
import { AddKeyword, ImportKeywords, RunPositions } from "./buttons";

export const metadata: Metadata = { title: "Positions Google" };
export const maxDuration = 60;

const dayFmt = new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "long", timeZone: "UTC" });
const COUNTRY: Record<string, string> = { CH: "Suisse", FR: "France", DE: "Allemagne", IT: "Italie", AT: "Autriche", BE: "Belgique", LU: "Luxembourg" };
const SOURCE: Record<string, string> = { search_console: "Search Console", calendar: "Calendrier", manual: "" };
const pathOf = (u: string) => { try { const x = new URL(u); return x.pathname === "/" ? "Accueil" : decodeURIComponent(x.pathname); } catch { return u; } };

/** La place, dite en texte et en couleur (jamais la couleur seule). */
function Place({ c }: { c: RankCheck | undefined }) {
  if (!c) return <span className="text-text-muted" title="Pas encore mesuré">—</span>;
  if (c.status === "error") return <span className="pill bg-danger-soft text-danger" title={c.error ?? undefined}>Erreur</span>;
  if (c.position == null) return <span className="pill bg-surface-sunken text-text-muted">Après {DEPTH}</span>;
  const tone = c.position <= 3 ? "bg-success-soft text-success" : c.position <= 10 ? "bg-info-soft text-info" : "bg-surface-sunken text-text";
  return <span className={`pill tabular-nums ${tone}`}>{c.position}<span className="sr-only">e place</span></span>;
}

function Move({ now, before }: { now: RankCheck | undefined; before: RankCheck | undefined }) {
  if (!now || now.status === "error") return <span className="text-text-muted">—</span>;
  const m = movement(now.position, before ? (before.status === "error" ? undefined : before.position) : undefined);
  if (m.kind === "up") return <span className="inline-flex items-center gap-0.5 font-semibold text-success"><ArrowUp aria-hidden="true" className="size-3.5" />{m.by}<span className="sr-only"> places gagnées</span></span>;
  if (m.kind === "down") return <span className="inline-flex items-center gap-0.5 font-semibold text-danger"><ArrowDown aria-hidden="true" className="size-3.5" />{m.by}<span className="sr-only"> places perdues</span></span>;
  if (m.kind === "new") return <span className="text-xs font-semibold text-success">Entré</span>;
  if (m.kind === "lost") return <span className="text-xs font-semibold text-danger">Sorti</span>;
  if (m.kind === "same") return <span className="text-text-muted">=</span>;
  return <span className="text-text-muted">—</span>;
}

/** Positions Google : la place du site pour chaque mot-clé suivi, chaque semaine. */
export default async function Positions() {
  const { workspace, site } = await requireSite();
  const host = hostOf(site.url) ?? site.url;
  const [max, keywords, weeks] = await Promise.all([db.rankPlan(workspace.id), db.listRankKeywords(workspace.id, site.id), db.rankWeeks(workspace.id, site.id, 2)]);
  const country = COUNTRY[locationOf(host).country] ?? "Suisse";

  if (!max) {
    return (<><PageHeader title="Positions Google" lead={`La place de ${host} dans Google pour vos mots-clés.`} /><EmptyState icon={TrendingUp} title="Pas compris dans votre offre">Le suivi des positions fait partie des offres Grow et Scale. <Link href="/app/abonnement" className="font-semibold text-accent underline underline-offset-2">Voir mon abonnement</Link></EmptyState></>);
  }

  const week = thisWeek();
  const tracked = keywords.slice(0, max);
  const [shown, prev] = [weeks[0] ?? null, weeks[1] ?? null];
  const checks = await db.listRankChecks(workspace.id, site.id, [shown, prev].filter(Boolean) as string[]);
  const cur = new Map(checks.filter((c) => c.week === shown).map((c) => [c.keywordId, c]));
  const old = new Map(checks.filter((c) => c.week === prev).map((c) => [c.keywordId, c]));
  const live = positionsLive();
  const measuredThisWeek = shown === week ? tracked.filter((k) => cur.has(k.id) && (!live || !cur.get(k.id)!.demo)).length : 0;
  const missing = tracked.length - measuredThisWeek;
  const demo = checks.some((c) => c.week === shown && c.demo);
  const okNow = tracked.map((k) => cur.get(k.id)).filter((c): c is RankCheck => Boolean(c && c.status === "ok"));
  const sum = summarize(okNow.map((c) => c.position));
  const okBefore = tracked.map((k) => old.get(k.id)).filter((c): c is RankCheck => Boolean(c && c.status === "ok"));
  const before = summarize(okBefore.map((c) => c.position));
  const nextMonday = dayFmt.format(new Date(`${addDays(week, 7)}T12:00:00Z`));
  const sorted = [...tracked].sort((a, b) => (cur.get(a.id)?.position ?? 999) - (cur.get(b.id)?.position ?? 999) || a.phrase.localeCompare(b.phrase));

  return (
    <>
      <PageHeader
        title="Positions Google"
        lead={<>La place de {host} dans Google ({country}, ordinateur) pour chacun de vos mots-clés. {missing ? "Mesure chaque lundi matin." : <>Prochaine mesure le lundi {nextMonday}.</>}</>}
        actions={tracked.length > 0 && missing > 0 ? <RunPositions again={measuredThisWeek > 0} /> : undefined}
      />
      {demo && <Banner tone="info"><strong className="font-semibold">Positions d'exemple :</strong> Google n'a pas été interrogé. Elles montrent à quoi ressemblera la page une fois DataForSEO branché sur le serveur.</Banner>}

      {!tracked.length ? (
        <EmptyState icon={TrendingUp} title="Quels mots-clés voulez-vous suivre ?" action={<ImportKeywords primary />}>
          Par exemple « déménagement neuchâtel » ou « nettoyage fin de bail lausanne ». Altiseo peut reprendre les recherches qui affichent déjà votre site dans Google (Search Console) et les mots-clés de votre calendrier ; vous pouvez aussi écrire les vôtres plus bas.
        </EmptyState>
      ) : !shown ? (
        <Card className="text-sm text-text-muted">Vos {tracked.length} mot{tracked.length > 1 ? "s" : ""}-clé{tracked.length > 1 ? "s" : ""} seront cherchés sur Google lundi matin. Vous pouvez aussi lancer la première mesure tout de suite, en haut de la page : comptez une minute.</Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label={`Dans le top 3, semaine du ${dayFmt.format(new Date(`${shown}T12:00:00Z`))}`} value={`${sum.top3}`} hint={`sur ${tracked.length} mot${tracked.length > 1 ? "s" : ""}-clé${tracked.length > 1 ? "s" : ""}`} tone={prev && sum.top3 > before.top3 ? "success" : "muted"} />
            <KpiCard label="Sur la 1re page (top 10)" value={`${sum.top10}`} hint={prev ? `Semaine d'avant : ${before.top10}` : "Première semaine suivie"} tone={prev && sum.top10 !== before.top10 ? (sum.top10 > before.top10 ? "success" : "danger") : "muted"} />
            <KpiCard label="Position moyenne" value={sum.average == null ? "—" : String(sum.average).replace(".", ",")} hint={sum.average == null ? `Aucun mot-clé dans les ${DEPTH} premiers` : `Des mots-clés classés dans les ${DEPTH} premiers`} tone="muted" />
            <KpiCard label={`Absents des ${DEPTH} premiers`} value={`${okNow.length - sum.top50}`} hint="Une page dédiée les aide souvent" tone={okNow.length - sum.top50 > 0 ? "danger" : "muted"} />
          </div>

          <section aria-labelledby="h-ranks" className="space-y-3">
            <div>
              <h2 id="h-ranks" className="text-lg">Vos positions</h2>
              <p className="text-sm text-text-muted">La flèche compare avec la semaine d'avant. « Après {DEPTH} » : le site n'est pas dans les {DEPTH} premiers résultats. Les annonces payantes ne sont pas comptées.</p>
            </div>
            <div className="card overflow-x-auto p-0">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-border text-xs text-text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-semibold">Mot-clé</th>
                    <th scope="col" className="px-3 py-2 text-center font-semibold">Position</th>
                    <th scope="col" className="px-3 py-2 text-center font-semibold">Évolution</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Page trouvée</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Les 3 premiers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sorted.map((k) => {
                    const c = cur.get(k.id);
                    return (
                      <tr key={k.id}>
                        <th scope="row" className="max-w-[260px] px-4 py-2.5 font-medium">{k.phrase}</th>
                        <td className="px-3 py-2.5 text-center"><Place c={c} /></td>
                        <td className="px-3 py-2.5 text-center"><Move now={c} before={old.get(k.id)} /></td>
                        <td className="max-w-[200px] truncate px-3 py-2.5 text-text-muted">{c?.url ? <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{pathOf(c.url)}</a> : "—"}</td>
                        <td className="max-w-[240px] px-3 py-2.5 text-xs text-text-muted">{c?.top.length ? c.top.map((t) => <span key={t.rank} className="block truncate">{t.rank}. {t.domain === host ? <strong className="text-text">{t.domain}</strong> : t.domain}</span>) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {shown === week && missing > 0 && <p className="text-xs text-text-muted">{missing} mot{missing > 1 ? "s" : ""}-clé{missing > 1 ? "s" : ""} pas encore mesuré{missing > 1 ? "s" : ""} cette semaine : ce sera fait demain matin, ou tout de suite avec le bouton en haut.</p>}
          </section>
        </>
      )}

      <section aria-labelledby="h-keywords" className="space-y-3">
        <div>
          <h2 id="h-keywords" className="text-lg">Mots-clés suivis ({keywords.length} sur {max})</h2>
          <p className="text-sm text-text-muted">Une recherche Google par mot-clé et par semaine, depuis la {country}. Retirer un mot-clé efface aussi son historique.</p>
        </div>
        {keywords.length > 0 && (
          <ul className="card divide-y divide-border p-0">
            {keywords.map((k, i) => (
              <li key={k.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                <span className="min-w-0 flex-1 text-sm">{k.phrase}{SOURCE[k.source] && <span className="ml-2 text-xs text-text-muted">{SOURCE[k.source]}</span>}{i >= max && <span className="pill ml-2 bg-warning-soft text-warning">Au-delà de votre offre : pas mesuré</span>}</span>
                <form action={removeRankKeyword}><input type="hidden" name="id" value={k.id} /><button className="text-xs font-semibold text-danger underline underline-offset-2">Retirer</button></form>
              </li>
            ))}
          </ul>
        )}
        <Card className="space-y-4">
          <AddKeyword disabled={keywords.length >= max} />
          {keywords.length > 0 && keywords.length < max && <ImportKeywords />}
          {!live && !demo && <p className="text-xs text-text-muted">DataForSEO n'est pas encore branché sur ce serveur : les mesures seront des exemples.</p>}
        </Card>
      </section>
    </>
  );
}
